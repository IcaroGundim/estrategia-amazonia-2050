// Salva em disco, byte a byte, os arquivos que o DesignSync(get_file) trouxe nesta sessão.
// Lê o transcript da sessão (JSONL) e os resultados persistidos em tool-results/,
// para que nada precise ser retranscrito à mão.
// Uso: node extrair-remotos.mjs <transcript.jsonl> <pasta-destino>
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';

const [transcript, destino] = process.argv.slice(2);
const linhas = readFileSync(transcript, 'utf8').split('\n').filter(Boolean);
const pastaResultados = join(dirname(transcript), transcript.split(/[\\/]/).pop().replace('.jsonl', ''), 'tool-results');

const salvos = new Map();
function registrar(texto) {
  let j;
  try { j = JSON.parse(texto); } catch { return; }
  if (j?.method !== 'get_file' || typeof j.content !== 'string') return;
  const buf = j.isBase64 ? Buffer.from(j.content, 'base64') : Buffer.from(j.content, 'utf8');
  salvos.set(j.path, { buf, truncado: j.truncated });
}

for (const linha of linhas) {
  let ev;
  try { ev = JSON.parse(linha); } catch { continue; }
  const partes = ev?.message?.content;
  if (!Array.isArray(partes)) continue;
  for (const p of partes) {
    if (p?.type !== 'tool_result') continue;
    const blocos = typeof p.content === 'string' ? [p.content] : (p.content || []).map((b) => b?.text).filter(Boolean);
    for (const t of blocos) {
      const persistido = t.match(/Full output saved to: (.+?\.txt)/);
      if (persistido) {
        const arq = existsSync(persistido[1]) ? persistido[1] : join(pastaResultados, persistido[1].split(/[\\/]/).pop());
        if (existsSync(arq)) registrar(readFileSync(arq, 'utf8'));
      } else {
        registrar(t);
      }
    }
  }
}

for (const [caminho, { buf, truncado }] of salvos) {
  const alvo = join(destino, caminho);
  mkdirSync(dirname(alvo), { recursive: true });
  writeFileSync(alvo, buf);
  console.log(`${truncado ? '! TRUNCADO ' : ''}${caminho} (${buf.length} B)`);
}
console.log(`${salvos.size} arquivos em ${destino}`);

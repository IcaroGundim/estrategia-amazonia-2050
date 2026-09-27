import React from 'react';

// Traçado do "Amazônia" cursivo, o mesmo de dashboard/src/layouts/Base.astro (.brand-rio).
// No site ele entra revelado por uma máscara que corre como um rio; aqui fica parado.
const CURSIVA = 'm241.7 101.7c-9-2.8-11.8-7.9-13.6-13.1-1.2-3.6-1.8-7.2-5.5-7.3-1.6 0.1-3.2 1-4.4 3.6s-1.3 3.7-2.2 6.6c-1.7 5-3.2 8.4-5.1 9.8-1.9 0.9-3.1-2-3.3-4.3-0.1-2.1 1.2-5.6 0-6.9-0.5-0.6-1.6-0.8-0.9-1.9 0.6-0.8 1.7-1.6 1.1-3-0.7-1.4-3.2-1.6-3.3 1.8-0.1 2.5 0.4 7-2.5 12.7-0.7 1.2-1.3 2.2-2.9 2-1.9-0.4-2.6-2.7-2.4-5.4 0.5-4.9 1.9-8 1.6-11-0.3-2.8-2.9-4.2-4.9-4.2-1.6 0-3.1 0.7-4 2.2-2 3.1-3.3 8-5.6 10.4-1.3 1.2-1.8 0-1.4-1.1 1-2.2 4-5.9 4.4-7.7 0.7-3.3-2.4-4.3-4.7-3.6-2.7 0.8-3.7 3.2-5.3 3.6-1.1 0.1-3-4.9-6.3-5.6-2.3-0.4-4.2 2.1-5.9 5.9-1.9 3.7-4.3 4.6-5.7 8.2-1.6 4.6-0.7 15.6-8.1 19.7-3.1 1.8-8.8 2.5-12.3 0.8-4.7-2.5-2-7.1 1.1-10.1 6.4-6 15.3-9.7 17.9-15.7 0.4-1 0.5-1.7 0.5-2.8 0-3-3-4.8-9.4-3.8-7.6 1.1-6.3 6.4-7.2 9.7-1.5 4.6-5.1 2.7-6.9-0.2-1.9-2.8-3.2-5.8-6.4-5.6-1.3 0.2-2.8 0.8-3.7 3.2-0.8 2.3-1.3 5.1-3.2 10.5-1.3 3.8-2.5 7.3-4.7 6.8-3.7-1.2-0.8-8.6-0.6-15.4 0.1-2.6-1.3-6.3-5.8-6.2-4.7 0-6.3 3.7-5.9 8 0.2 4 1.7 7.7 0.1 10.6-1.2 1.8-4.1 1.8-3.9-2.6 0.1-2.7 1.2-6.4 1-8.5-0.3-1.8-1.8-3.9-4.9-3.9-2.9 0-5.1 1.6-5.2 5.5l0.1 4.9c0.1 5.2-3.5 5.3-4.5 2.1-0.8-2.8-1.3-8.2-2.7-12.6-1.2-3.8-2.8-5.4-5.5-5.4-2.9 0.2-4.3 2.6-5.7 5.5-3.8 8.2-6.3 14.3-15 17.5-0.8 0.3-1.3 0.7-1.3 1.2 0 2.5 3.5 2.3 6.4 0.1 4-2.9 6.1-6.8 9.5-9 2.7-2 7.3-3 10.3 0.3 1.7 2 2.5 5.6 4 7.4 0.7 0.6 1.2 0.9 2.3 0.8 3.1-0.1 4.8-3.1 4.7-5.9 0.1-3-0.8-7.7 0.5-9.4 1.3-1.8 5.1-2 4.8 2.1-0.5 3.1-1.4 6.6-1.5 8.4-0.1 3.5 1.8 5.5 4.7 5.4 4.3-0.1 6.2-4.1 5.2-7.9-0.7-2.7-2.4-6.8-1.2-9.5 1.4-2.9 6.7-3.7 6.4 1.5-0.4 4.8-3.1 17.3 2.9 17.7 2.9 0.1 4.4-1.6 7.2-5.7 2-2.6 9.1-7.4 12.9-6.9 1.1 0.2 1.8 0.7 2.8 0.6 3.6-0.2 4.5-6.9 5.2-8.9 1-2.4 3.5-3.6 8.1-3.7 1.5 0 3.3 0.1 3.5 1.8 0.2 3.7-7.9 7.8-16.9 15.5-2.6 2.3-6.8 6.5-6.5 11 0.7 6 10.1 7.8 17.9 4.3 2.7-1.3 5-3.1 6.9-6.8 4.3-7.1 2.6-16.9 5.3-18.5 0.6-0.4 1.3-0.2 1.4 0.7 0.6 2.9 1.7 7.1 6.1 7.1 2.2-0.1 3.9-1.2 5.3-3.8 1.8-3.4 1.2-9.6 4.6-11.7 2.1-1 4.6 0 4 2.6-0.9 3.6-5.7 6.2-5.2 8.9 0.2 1.5 3.1 3 5.2 1.3 2.9-2.5 3.4-8.3 6-11.1 1.9-2.3 5.4-1.3 5.3 2.5 0 3.8-2.2 10.3-1 13.8 0.5 1.3 1.4 2.5 3.9 2.5 4-0.3 5.4-3.1 6.6-7.4h0.3c0.4 3.6 1.4 6.8 4.2 6.8 4.2 0 4.9-5.7 6.9-7.1 1.9-1.7 5.7 0.2 8.9-0.9l2.5-1.3c4.3 6.4 11.6 9.9 15.3 9.9 1 0.1 1.9-1.9 0.1-2.5h-0.8zm-169.5-7.4c1.2-3.3 3.1-9.7 5.8-9.8 2.9-0.1 4.6 8.7 5.3 11.9-2.9-2.2-6.1-3.8-10.9-2.2l-0.2 0.1zm52.3 4.5v-0.2c0.5-1.6 1.8-5 2.2-7.6 1.3-5.1 4.6-2.6 8 2.9-5 0-7.4 3.2-10.1 4.8l-0.1 0.1zm48-4.4c-1.8 4.7-7.1 1.9-7.5-3.1 0-2 4.6-6 7-6.3 2.3-0.1 2.3 3 1.5 7.2l-1 2.2zm-6.8-7.9-0.3-0.1c1.1-2.7 4.7-7.5 8-2.8-2.7-1-4.8-0.2-7.7 3v-0.1zm50.9 7 1.8-6.2c1-1.7 2.5-3.4 4.6-2.3 0.9 0.6 2.5 4.8 2.8 6-1.9 4.1-6.4 2.3-9.1 2.7z';

const ROTAS_PADRAO = [
  { key: 'metodologia', label: 'Visão Geral' },
  { key: 'metas', label: 'Metas e indicadores' },
  { key: 'index', label: 'Panorama' }
];

/** Marca da Estratégia: rótulo em versalete, "Amazônia" em letra cursiva e o ano em ocre. */
function Marca({ eyebrow, year }) {
  return (
    <span style={{
      display: 'flex', alignItems: 'center', gap: '12px', paddingLeft: '18px',
      borderLeft: '1px solid rgba(245, 240, 232, 0.2)', color: 'var(--areia)', whiteSpace: 'nowrap'
    }}>
      <span style={{ display: 'grid', gap: '4px' }}>
        <small style={{ font: '600 10px/1 var(--text)', letterSpacing: '0.16em', textTransform: 'uppercase', color: 'var(--mata-100)' }}>{eyebrow}</small>
        <strong style={{ display: 'block', lineHeight: 0 }}>
          <svg viewBox="56 79.1 188 40" fill="currentColor" aria-hidden="true" focusable="false" style={{ display: 'block', height: '45px', width: 'auto', aspectRatio: '188 / 40' }}>
            <path d={CURSIVA} />
          </svg>
        </strong>
      </span>
      <b style={{ position: 'relative', top: '2px', font: '800 46px/0.78 var(--display)', letterSpacing: '-0.045em', color: 'var(--ocre)' }}>{year}</b>
    </span>
  );
}

/** Idiomas lado a lado: a bandeira da página acesa e sublinhada, a outra apagada como link. */
function Idiomas({ languages, language, onLanguage }) {
  const bandeira = { height: '14px', width: 'auto', display: 'block', border: '1px solid rgba(245, 240, 232, 0.34)', borderRadius: '2px' };
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', alignSelf: 'stretch', marginLeft: '-22px' }}>
      {languages.map((idioma, indice) => {
        const atual = idioma.code === language;
        return (
          <React.Fragment key={idioma.code}>
            {indice > 0 ? <span aria-hidden="true" style={{ width: '1px', height: '16px', background: 'rgba(245, 240, 232, 0.28)' }} /> : null}
            {atual ? (
              <span aria-hidden="true" style={{ position: 'relative', display: 'flex', alignItems: 'center', padding: '10px 4px' }}>
                <img src={idioma.flagSrc} alt="" style={{ ...bandeira, aspectRatio: idioma.ratio }} />
                <i style={{ position: 'absolute', right: '4px', bottom: '3px', left: '4px', height: '2px', borderRadius: '2px', background: 'var(--ocre)' }} />
              </span>
            ) : (
              <a
                href={idioma.href || '#'}
                aria-label={idioma.label}
                title={idioma.label}
                onClick={onLanguage ? (evento) => { evento.preventDefault(); onLanguage(idioma.code); } : undefined}
                style={{ position: 'relative', display: 'flex', alignItems: 'center', padding: '10px 4px' }}
              >
                <img src={idioma.flagSrc} alt="" style={{ ...bandeira, aspectRatio: idioma.ratio, opacity: 0.45, filter: 'saturate(0.4)' }} />
              </a>
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

/** Barra fixa do topo: logo do Consórcio e marca da Estratégia, rotas, uma ação e o seletor de idioma. */
export function Topbar({
  logoSrc,
  eyebrow = 'Estratégia Regional',
  year = '2050',
  showBrand = true,
  items = ROTAS_PADRAO,
  active,
  action,
  languages,
  language = 'pt-BR',
  onNavigate,
  onLanguage,
  style,
  ...rest
}) {
  return (
    <header
      {...rest}
      style={{
        position: 'sticky', top: 0, zIndex: 20,
        background: 'var(--mata)', color: 'var(--areia)',
        boxShadow: 'var(--sombra-topbar)',
        ...style
      }}
    >
      <div style={{
        width: 'min(var(--largura-maxima), 100%)', minHeight: 'var(--altura-topbar)', margin: '0 auto',
        padding: '10px var(--margem-pagina)', display: 'flex', alignItems: 'center', gap: '34px'
      }}>
        <a href="#" aria-label={`${eyebrow} Amazônia ${year}, início`} style={{ display: 'flex', alignItems: 'center', gap: '18px', minWidth: 'max-content', color: 'inherit', textDecoration: 'none' }}>
          {logoSrc
            ? <img src={logoSrc} alt="" style={{ width: '172px', height: '60px', display: 'block', objectFit: 'contain' }} />
            : null}
          {showBrand ? <Marca eyebrow={eyebrow} year={year} /> : null}
        </a>

        <nav style={{ display: 'flex', alignSelf: 'stretch', alignItems: 'center', gap: '25px', marginLeft: '18px' }}>
          {items.map((item) => {
            const ativo = item.key === active;
            return (
              <a
                key={item.key}
                href={item.href || '#'}
                aria-current={ativo ? 'page' : undefined}
                onClick={onNavigate ? (evento) => { evento.preventDefault(); onNavigate(item.key); } : undefined}
                style={{
                  position: 'relative', padding: '10px 0', textDecoration: 'none', whiteSpace: 'nowrap',
                  color: ativo ? 'var(--ocre)' : 'rgba(245, 240, 232, 0.7)',
                  fontSize: '13px', fontWeight: ativo ? 600 : 400
                }}
              >
                {item.label}
                {ativo ? <i style={{ position: 'absolute', right: 0, bottom: '3px', left: 0, height: '2px', borderRadius: '2px', background: 'var(--ocre)' }} /> : null}
              </a>
            );
          })}
        </nav>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginLeft: 'auto', whiteSpace: 'nowrap' }}>{action}</div>

        {languages && languages.length ? <Idiomas languages={languages} language={language} onLanguage={onLanguage} /> : null}
      </div>
    </header>
  );
}

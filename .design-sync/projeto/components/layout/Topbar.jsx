import React from 'react';

const ROTAS_PADRAO = [
  { key: 'metodologia', label: 'Visão Geral' },
  { key: 'metas', label: 'Metas e indicadores' },
  { key: 'index', label: 'Panorama' }
];

/**
 * Marca da Estratégia, provisória até sair o manual de uso da marca: rótulo em
 * versalete sobre "Amazônia 2050" em display 800, com o ano em ocre no mesmo corpo.
 * Tudo em texto — nenhuma letra cursiva ou manuscrita. O mesmo de
 * dashboard/src/layouts/Base.astro (.brand-product).
 */
function Marca({ eyebrow, year }) {
  return (
    <span style={{
      display: 'flex', alignItems: 'center', paddingLeft: '18px',
      borderLeft: '1px solid rgba(245, 240, 232, 0.2)', color: 'var(--areia)', whiteSpace: 'nowrap'
    }}>
      <span style={{ display: 'grid', gap: '5px' }}>
        <small style={{ font: '600 10px/1 var(--text)', letterSpacing: '0.16em', textTransform: 'uppercase', color: 'var(--mata-100)' }}>{eyebrow}</small>
        <strong style={{ display: 'flex', alignItems: 'baseline', gap: '0.24em', font: '800 30px/0.86 var(--display)', letterSpacing: '-0.035em' }}>
          <span>Amazônia</span>
          <b style={{ font: 'inherit', letterSpacing: 'inherit', color: 'var(--ocre)' }}>{year}</b>
        </strong>
      </span>
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

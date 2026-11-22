#!/usr/bin/env node
/* Gera <slug>/index.html + <slug>/og.jpg a partir de <slug>/dados.json.
   Uso:  node _build/build.js <slug> [--fotos <dir-de-origem>]
         node _build/build.js --all                (regera todas as paginas)
   Nao tem dependencia npm: usa ImageMagick (convert) e, se faltar, Pillow. */

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const TPL = path.join(__dirname, 'template.html');
const CFG = path.join(ROOT, '_config.json');
const IMOVEIS = path.join(ROOT, 'imovel');   // cada imovel fica em imovel/<slug>
const MAXW_FOTO = 1600;
const Q = 82;

// ---------- utilitarios ----------
const esc = s => String(s == null ? '' : s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

const brl = n => 'R$ ' + Number(n).toLocaleString('pt-BR', { maximumFractionDigits: 0 });

function money(v) {
  if (v == null || v === '' || v === false) return null;
  if (typeof v === 'number') return brl(v);
  return String(v);
}

function has(bin) {
  try { execFileSync('sh', ['-c', `command -v ${bin}`], { stdio: 'ignore' }); return true; }
  catch { return false; }
}
const HAS_IM = has('convert');

function jpeg(src, dest, opts) {
  // opts: {w, h}  -> h presente = corte central exato (capa OG)
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  if (HAS_IM) {
    const geo = opts.h ? `${opts.w}x${opts.h}^` : `${opts.w}x>`;
    const args = ['-auto-orient', src + '[0]', '-resize', geo];
    if (opts.h) args.push('-gravity', 'center', '-extent', `${opts.w}x${opts.h}`);
    args.push('-strip', '-interlace', 'Plane', '-quality', String(Q), 'jpg:' + dest);
    execFileSync('convert', args, { stdio: 'pipe' });
  } else {
    const py = `
import sys
from PIL import Image, ImageOps
im = ImageOps.exif_transpose(Image.open(sys.argv[1])).convert("RGB")
w, h = int(sys.argv[3]), int(sys.argv[4] or 0)
if h:
    im = ImageOps.fit(im, (w, h), Image.LANCZOS, centering=(.5, .5))
elif im.width > w:
    im = im.resize((w, round(im.height * w / im.width)), Image.LANCZOS)
im.save(sys.argv[2], "JPEG", quality=${Q}, optimize=True, progressive=True)
`;
    execFileSync('python3', ['-I', '-c', py, src, dest, String(opts.w), String(opts.h || 0)], { stdio: 'pipe' });
  }
}

// ---------- importacao de fotos ----------
function importarFotos(slug, dir) {
  const destDir = path.join(IMOVEIS, slug, 'fotos');
  const exts = /\.(jpe?g|png|webp|avif|heic|tiff?)$/i;
  const src = fs.readdirSync(dir).filter(f => exts.test(f)).sort((a, b) => a.localeCompare(b, 'pt-BR', { numeric: true }));
  if (!src.length) throw new Error('nenhuma imagem em ' + dir);
  fs.rmSync(destDir, { recursive: true, force: true });
  fs.mkdirSync(destDir, { recursive: true });
  src.forEach((f, i) => {
    const out = path.join(destDir, String(i + 1).padStart(2, '0') + '.jpg');
    jpeg(path.join(dir, f), out, { w: MAXW_FOTO });
    process.stdout.write(`  foto ${path.basename(out)}  ${(fs.statSync(out).size / 1024).toFixed(0)} KB\n`);
  });
  return src.length;
}

// ---------- render ----------
function render(slug) {
  const dir = path.join(IMOVEIS, slug);
  const d = JSON.parse(fs.readFileSync(path.join(dir, 'dados.json'), 'utf8'));
  const cfg = JSON.parse(fs.readFileSync(CFG, 'utf8'));
  if (!/^55\d{10,11}$/.test(String(cfg.whatsapp || '')))
    throw new Error('_config.json: "whatsapp" precisa ser o numero com DDI+DDD, so digitos (ex. 5562999887766)');
  if (!cfg.corretor || /PREENCHER/i.test(cfg.corretor))
    throw new Error('_config.json: "corretor" precisa do nome que assina o rodape da pagina');
  if (!/^https:\/\//.test(String(cfg.base_url || '')))
    throw new Error('_config.json: "base_url" precisa ser a URL https do projeto');
  const base = cfg.base_url.replace(/\/+$/, '');
  const url = `${base}/imovel/${slug}`;

  const fotos = fs.readdirSync(path.join(dir, 'fotos'))
    .filter(f => /\.jpg$/i.test(f))
    .sort((a, b) => a.localeCompare(b, 'pt-BR', { numeric: true }))
    .map(f => 'fotos/' + f);
  if (!fotos.length) throw new Error(`${slug}: pasta fotos/ vazia — rode com --fotos <dir>`);

  const capa = d.capa && fotos.includes(d.capa) ? d.capa : fotos[0];

  // capa OG: 1200x630 absoluto, JPEG leve (WhatsApp ignora WebP e arquivo grande)
  jpeg(path.join(dir, capa), path.join(dir, 'og.jpg'), { w: 1200, h: 630 });
  const ogKB = fs.statSync(path.join(dir, 'og.jpg')).size / 1024;
  if (ogKB > 300) console.warn(`  ! og.jpg com ${ogKB.toFixed(0)} KB (ideal < 300 KB)`);

  const f = d.ficha || {};
  const preco = d.preco_texto || (d.preco ? brl(d.preco) : 'Valor sob consulta');

  // ---- subtitulo do preco (condominio / IPTU) ----
  const sub = [];
  if (money(f.condominio)) sub.push('Condomínio ' + money(f.condominio));
  if (money(f.iptu)) sub.push('IPTU ' + money(f.iptu) + (f.iptu_periodo ? '/' + f.iptu_periodo : ''));
  const precoSub = sub.length ? `<small>${esc(sub.join(' · '))}</small>` : '';

  // ---- ficha tecnica ----
  const campos = [
    ['Área privativa', f.area_privativa],
    ['Área total', f.area_total],
    ['Quartos', f.quartos],
    ['Suítes', f.suites],
    ['Banheiros', f.banheiros],
    ['Vagas', f.vagas],
    ['Condomínio', money(f.condominio) ? money(f.condominio) + '<span>/mês</span>' : null],
    ['IPTU', money(f.iptu) ? money(f.iptu) + (f.iptu_periodo ? `<span>/${esc(f.iptu_periodo)}</span>` : '') : null],
    ['Andar', f.andar],
    ['Posição', f.posicao],
  ].filter(([, v]) => v != null && v !== '');
  const ficha = campos.map(([k, v]) =>
    `<div><dt>${esc(k)}</dt><dd>${String(v).includes('<span>') ? v : esc(v)}</dd></div>`).join('\n      ');

  // ---- galeria ----
  const galeria = fotos.map((src, i) =>
    `<button type="button" aria-label="Ampliar foto ${i + 1}"><img src="${esc(src)}" alt="" ` +
    `loading="${i < 3 ? 'eager' : 'lazy'}" decoding="async"></button>`).join('\n    ');

  // ---- textos ----
  const destaques = (d.destaques || []).map(x => `<li>${esc(x)}</li>`).join('\n    ');
  const descritivo = (Array.isArray(d.descritivo) ? d.descritivo : [d.descritivo])
    .filter(Boolean).map(p => `<p>${esc(p)}</p>`).join('\n    ');
  const bairroTexto = (Array.isArray(d.bairro_texto) ? d.bairro_texto : [d.bairro_texto])
    .filter(Boolean).map(p => `<p>${esc(p)}</p>`).join('\n    ');

  // ---- open graph ----
  const ogTitle = d.og?.titulo || `${d.tipo} em ${d.bairro} — ${preco}`;
  const ogDesc = d.og?.descricao || [
    f.quartos ? `${f.quartos} quarto${f.quartos > 1 ? 's' : ''}` : null,
    f.suites ? `${f.suites} suíte${f.suites > 1 ? 's' : ''}` : null,
    f.area_privativa || f.area_total,
    f.vagas ? `${f.vagas} vaga${f.vagas > 1 ? 's' : ''}` : null,
  ].filter(Boolean).join(' · ');

  // ---- whatsapp ----
  const msg = (cfg.mensagem || 'Olá! Vi a página do imóvel em {bairro} ({preco}) e quero mais informações.')
    .replace('{tipo}', d.tipo).replace('{bairro}', d.bairro)
    .replace('{titulo}', d.titulo).replace('{preco}', preco);
  const wa = `https://wa.me/${cfg.whatsapp}?text=${encodeURIComponent(msg + '\n' + url)}`;

  const vals = {
    URL: url, CAPA: capa, OG_IMAGE: `${url}/og.jpg`,
    OG_TITLE: ogTitle, OG_DESC: ogDesc,
    TITULO: d.titulo, TIPO: d.tipo, BAIRRO: d.bairro,
    PRECO: preco, CORRETOR: cfg.corretor,
    CAPA_POS: d.capa_posicao || 'center',
    CTA_TITULO: d.cta_titulo || 'Quer conhecer pessoalmente?',
    CTA_TEXTO: d.cta_texto || 'Me chame no WhatsApp que eu organizo a visita no horário que for melhor para você e envio o que mais precisar sobre o imóvel.',
  };

  let html = fs.readFileSync(TPL, 'utf8');
  for (const [k, v] of Object.entries(vals)) html = html.replaceAll(`{{${k}}}`, esc(v));
  html = html
    .replaceAll('{{PRECO_SUB}}', precoSub)
    .replaceAll('{{DESTAQUES}}', destaques)
    .replaceAll('{{GALERIA}}', galeria)
    .replaceAll('{{FICHA}}', ficha)
    .replaceAll('{{DESCRITIVO}}', descritivo)
    .replaceAll('{{BAIRRO_TEXTO}}', bairroTexto)
    .replaceAll('{{REF}}', d.referencia ? `<p class="ref">Referência ${esc(d.referencia)}</p>` : '')
    .replaceAll('{{CRECI}}', cfg.creci ? ' · CRECI ' + esc(cfg.creci) : '')
    .replaceAll('{{WA_LINK}}', esc(wa))
    .replaceAll('{{FOTOS_JSON}}', JSON.stringify(fotos));

  const sobrou = html.match(/\{\{[A-Z_]+\}\}/g);
  if (sobrou) throw new Error('placeholder sem valor: ' + [...new Set(sobrou)].join(', '));

  fs.writeFileSync(path.join(dir, 'index.html'), html);
  console.log(`  ok  ${url}   (${fotos.length} fotos, og ${ogKB.toFixed(0)} KB, html ${(html.length / 1024).toFixed(0)} KB)`);
  return url;
}

// ---------- cli ----------
const argv = process.argv.slice(2);
if (!argv.length) { console.error('uso: node _build/build.js <slug> [--fotos <dir>] | --all'); process.exit(1); }

if (argv[0] === '--all') {
  const slugs = (fs.existsSync(IMOVEIS) ? fs.readdirSync(IMOVEIS, { withFileTypes: true }) : [])
    .filter(e => e.isDirectory())
    .filter(e => fs.existsSync(path.join(IMOVEIS, e.name, 'dados.json')))
    .map(e => e.name);
  slugs.forEach(s => { console.log(s); render(s); });
  console.log(`\n${slugs.length} página(s) regerada(s).`);
} else {
  const slug = argv[0].replace(/\/+$/, '');
  const i = argv.indexOf('--fotos');
  console.log(slug);
  if (i > -1) importarFotos(slug, argv[i + 1]);
  render(slug);
}

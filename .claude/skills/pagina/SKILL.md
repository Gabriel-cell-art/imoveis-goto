---
name: pagina
description: Monta e publica a página de apresentação de um imóvel para enviar por WhatsApp. Usar quando o usuário digitar /pagina, mandar um anúncio, uma ficha de imóvel ou um conjunto de fotos pedindo "faz a página".
---

# /pagina — página de apresentação de imóvel

Produz uma página de rolagem vertical, pensada para o cliente abrir no celular a partir de um
link do WhatsApp, e publica em `https://imoveis-goto.vercel.app/<slug>`.

O repositório é a fonte da verdade: **cada imóvel é uma pasta na raiz**, e o site é republicado
inteiro a cada push. Nunca apague pastas de imóveis anteriores — os links já foram enviados a clientes.

## 1. Reunir o material

Precisa de: tipo, bairro, cidade, preço, ficha (área, quartos, suítes, vagas, condomínio, IPTU),
a descrição do anúncio e as fotos.

- Se vier um **link de anúncio**, tente baixar a página e as fotos. A rede do ambiente é restrita:
  se o host estiver bloqueado, peça ao usuário para colar o texto e mandar as fotos como anexo —
  não invente o conteúdo e não insista em liberar o host sem necessidade.
- Guarde as fotos originais em `_originais/<slug>/` (está no `.gitignore`, não vai para o repo).
- **Regra dura:** todo dado da ficha vem da fonte. Se o anúncio não diz quantas vagas, o campo
  simplesmente não aparece na página. Nunca estime área, condomínio, IPTU ou número de vagas.

## 2. Definir o slug

Minúsculas, sem acento, com hífen, curto e estável: `apto-3q-setor-marista`, `casa-alphaville-2`.
O slug vira o link. **Não renomeie a pasta depois de enviar o link a alguém.**

## 3. Escrever o `dados.json`

Crie `<slug>/dados.json`. Campos nulos ou ausentes são omitidos na página.

```json
{
  "titulo": "frase curta, concreta, sem adjetivo vazio",
  "tipo": "Apartamento",
  "bairro": "Setor Marista",
  "preco": 890000,
  "preco_texto": null,
  "referencia": "AP-1042",
  "capa": "fotos/01.jpg",
  "destaques": ["3 a 5 frases curtas"],
  "ficha": {
    "area_privativa": "98 m²", "area_total": null,
    "quartos": 3, "suites": 1, "banheiros": 2, "vagas": 2,
    "condominio": 780, "iptu": 1200, "iptu_periodo": "ano",
    "andar": "11º", "posicao": null
  },
  "descritivo": ["parágrafo 1", "parágrafo 2", "parágrafo 3"],
  "bairro_texto": "2 a 3 linhas sobre a região",
  "cta_titulo": null,
  "cta_texto": null
}
```

### Tom do texto

- **Direto, sem exagero, sem emoji.** Nada de "oportunidade única", "imperdível", "alto padrão",
  "sofisticado", "exclusivo", "aconchegante". Se a frase serve para qualquer imóvel, corte.
- **Descritivo:** 2 a 3 parágrafos, escritos com palavras próprias a partir dos dados e da descrição
  do anúncio. Não copie o texto do anúncio. Descreva o que a pessoa vai encontrar: posição do sol,
  como os cômodos se organizam, o que já está pronto. Cada parágrafo carrega informação nova.
- **Destaques:** 3 a 5, cada um com um fato verificável. "Duas vagas cobertas lado a lado" serve;
  "localização privilegiada" não.
- **Sobre o bairro:** 2 a 3 linhas sobre a região, comércio e acesso. **Nunca o endereço exato,
  nem o nome do edifício, nem número, nem ponto de referência que identifique a quadra.** Isso vale
  também para o `dados.json`, que fica público.

## 4. Gerar a página

```bash
node _build/build.js <slug> --fotos _originais/<slug>
```

O script redimensiona as fotos para `<slug>/fotos/NN.jpg` (máx. 1600 px), recorta a capa em
`og.jpg` 1200×630 para a prévia do WhatsApp e escreve `<slug>/index.html`.
Para só regerar o HTML depois de editar o texto, rode sem `--fotos`.
`node _build/build.js --all` regera todas as páginas (use depois de mexer no template).

Ordem das fotos = ordem alfabética dos arquivos de origem. A capa é a `01.jpg`, a não ser que
`capa` aponte outra.

## 5. Conferir antes de publicar

Sirva a pasta e tire um screenshot no viewport de celular antes de mandar o link:

```bash
python3 -m http.server 8099 &
node -e "const{chromium,devices}=require('playwright');(async()=>{const b=await chromium.launch();const p=await(await b.newContext({...devices['iPhone 13']})).newPage();await p.goto('http://127.0.0.1:8099/<slug>/');await p.waitForTimeout(900);await p.screenshot({path:'/tmp/pagina.png',fullPage:true});await b.close()})()"
```

Verifique: capa não corta o título, preço certo, ficha sem campo inventado, nenhum endereço exato,
nenhum emoji, botão do WhatsApp abrindo o número de `_config.json`.

## 6. Publicar

```bash
git add -A && git commit -m "<slug>: página de apresentação" && git push
```

A Vercel publica sozinha em ~1 minuto. Confirme que `https://imoveis-goto.vercel.app/<slug>`
responde 200 e devolva o link pronto para copiar, em uma linha, sem markdown ao redor.

## Cuidados que já custaram caro

- **O WhatsApp guarda a prévia por link.** Se o preço mudar depois que o link já circulou,
  republicar a mesma pasta não atualiza a prévia antiga: crie uma pasta nova (slug novo) e mande
  o link novo. Dentro da página o valor atualiza normalmente.
- **`og:image` tem que ser JPEG absoluto e leve.** O `build.js` já cuida disso; não troque a tag
  por uma foto em WebP nem aponte para o CDN do portal — o WhatsApp não renderiza e o link sai sem foto.
- **Nunca hotlinke fotos do portal.** Quando o anúncio sai do ar, a página fica vazia.
- **`noindex` tira do Google, não torna o link privado.** Quem receber pode repassar.
  Se o preço for sigiloso, não publique.

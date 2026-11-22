# imoveis-goto

Páginas de apresentação de imóveis para enviar por WhatsApp.
Site estático publicado na Vercel: `https://imoveis-goto.vercel.app/imovel/<slug>`.

| Caminho | O que é |
|---|---|
| `imovel/<slug>/` | Um imóvel: `dados.json`, `fotos/`, `og.jpg` e `index.html` gerados |
| `_build/` | `template.html` e `build.js` (gerador, sem dependência npm) |
| `_config.json` | WhatsApp, nome do corretor, CRECI, URL base |
| `_originais/` | Fotos originais, fora do repo (`.gitignore`) |
| `.claude/skills/pagina/` | O comando `/pagina` |

```bash
node _build/build.js <slug> --fotos _originais/<slug>   # importa fotos + gera a página
node _build/build.js <slug>                             # só regera o HTML
node _build/build.js --all                              # regera tudo (após mexer no template)
```

Cada push republica o site inteiro. **Não apague pastas de imóveis antigos:** os links já estão
com clientes.

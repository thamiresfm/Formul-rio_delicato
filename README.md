# Formulário Delicatto (Caixa Love)

> Versões antigas falavam em `/docs`, Render e `DELICATO_API_URL`. **Isso não vale mais.**

## O que o projeto faz hoje

- Após **confirmar o pedido**, o cliente usa **um botão** para abrir o **WhatsApp** com o texto do pedido (número da loja no `app.js`).
- **GitHub Pages** publica HTML/CSS/JS na **raiz** do repositório. **Sem** backend obrigatório para o fluxo do formulário.

## Rodar local

```bash
npm install
npm start
```

Abra `http://localhost:3000`. O `server.js` serve a pasta `public/`.

## GitHub Pages (raiz `/`)

**Settings → Pages → Branch: `main`, Folder: `/ (root)`**.

1. Edite **`public/`**.
2. `npm run sync-pages`
3. Commit e push na raiz: `index.html`, `app.js`, `styles.css`, `assets/`, `.nojekyll`.

## Problemas comuns

| Situação | O que fazer |
|----------|-------------|
| Site desatualizado no ar | `npm run sync-pages`, commit e push. |
| WhatsApp não abre (app interno) | Abrir o site no **Safari** ou **Chrome**. |

---

## OpenAI (opcional, só no `npm start`)

Sugestão de frase via `POST /api/ia/sugestao-frase` — veja `.env.example` e a seção no `server.js`. **Nunca** coloque a chave no frontend.

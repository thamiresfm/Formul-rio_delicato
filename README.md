# Formulário Delicatto (Caixa Love)

## Rodar local (com API Word + fotos)

```bash
npm install
npm start
```

Abra `http://localhost:3000`.

## GitHub Pages (`/docs`)

O repositório publica o site estático pela pasta **`docs`** (configuração do GitHub Pages: branch **main**, pasta **/docs**).

1. Após alterar `public/`, atualize a cópia em `docs/`:

   ```bash
   npm run sync-docs
   ```

2. **Backend:** o GitHub Pages só serve HTML/CSS/JS. A API (`/api/pedido`) precisa rodar em outro lugar (ex.: [Render](https://render.com), Railway). No arquivo **`docs/index.html`**, preencha a URL do servidor:

   ```html
   <script>
     window.DELICATO_API_URL = "https://SEU-SERVIDOR.onrender.com";
   </script>
   ```

   Deixe `""` apenas para testes locais com `npm start`.

3. Faça commit e push da pasta `docs/`.

O servidor Node já usa `cors` aberto; em produção, restrinja a origem ao domínio do GitHub Pages se quiser.

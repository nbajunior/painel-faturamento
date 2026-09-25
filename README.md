# Painel de Faturamento — Fase 1

Painel web para consolidar o faturamento (Água/Esgoto), Cancelamento e
Indiretas (Serviço Avulso), a partir dos CSVs exportados diariamente.
Roda inteiramente no navegador (nenhum servidor pra manter) e usa o
Firebase só para guardar o resultado calculado e controlar login.

**O que esta Fase 1 já faz:**
- Login individual por e-mail/senha (só quem você cadastrar consegue entrar)
- Upload da Fatura de Ciclo + Serviço Avulso do ciclo atual
- Cálculo automático de: Faturamento Água, Faturamento Esgoto, Cancelamento,
  Indiretas por categoria (Corte, Religação, LNA, LNE, Sanção, Outros)
- Detalhamento por ciclo (Grupo) e localidade
- Publicação: quem sobe os arquivos clica em "Publicar" e todo mundo que
  abrir o link passa a ver esse resumo — sem precisar subir nada de novo

**O que ainda não está aqui (próximas fases):**
- Comparação mês a mês (Fase 2)
- Consumo / migração de economias entre ciclos (Fase 2)
- Orçado editável + DRE completo no layout do FAT. CICLOS (3) (Fase 3)

---

## Passo a passo

### Parte A — Colocar o código no GitHub e publicar o site

1. Crie uma conta no [github.com](https://github.com) se ainda não tiver.
2. Clique em **New repository** (botão verde). Dê um nome, ex: `painel-faturamento`.
   Marque como **Private** se preferir (isso não afeta o acesso ao site publicado,
   veja o aviso na Parte C).
3. Na página do repositório recém-criado, clique em **Add file > Upload files**
   e arraste todos os arquivos e pastas deste projeto (mantendo a estrutura de
   pastas `css/` e `js/`). Clique em **Commit changes**.
4. Vá em **Settings > Pages** (menu lateral do repositório).
5. Em **Source**, selecione **Deploy from a branch**, branch `main`, pasta `/ (root)`.
   Clique em **Save**.
6. Aguarde 1-2 minutos. O GitHub vai te mostrar um link parecido com
   `https://seu-usuario.github.io/painel-faturamento/`. **Esse é o link que
   você vai enviar para a equipe.**

> Nesse ponto o site já está no ar, mas ainda não funciona (falta configurar
> o Firebase — próxima parte).

### Parte B — Criar o Firebase (login + banco de dados)

1. Acesse [console.firebase.google.com](https://console.firebase.google.com) e
   faça login com uma conta Google.
2. Clique em **Adicionar projeto**, dê um nome (ex: `painel-faturamento`) e siga
   o assistente (pode desativar o Google Analytics, não é necessário).
3. **Ativar login por e-mail/senha:**
   - No menu lateral, vá em **Build > Authentication**.
   - Clique em **Get started**.
   - Na aba **Sign-in method**, clique em **Email/Password**, ative a primeira
     opção e clique em **Save**.
4. **Cadastrar as pessoas que podem acessar:**
   - Ainda em Authentication, vá na aba **Users**.
   - Clique em **Add user**, digite o e-mail e uma senha provisória para cada
     pessoa da equipe. Repita para todos que devem ter acesso.
   - Cada pessoa pode trocar a senha depois usando "Esqueci minha senha" na
     tela de login do painel.
5. **Criar o banco de dados (Firestore):**
   - No menu lateral, vá em **Build > Firestore Database**.
   - Clique em **Create database**. Escolha a localização mais próxima
     (ex: `southamerica-east1` — São Paulo). Comece em **modo de produção**.
6. **Configurar as regras de segurança:**
   - Na aba **Rules** do Firestore, apague o conteúdo e cole o conteúdo do
     arquivo `firestore.rules` deste projeto. Clique em **Publish**.
7. **Pegar as credenciais do projeto:**
   - Clique na engrenagem (⚙) ao lado de "Project Overview" > **Project settings**.
   - Role até **Your apps**, clique no ícone `</>` (Web) para criar um app web.
   - Dê um nome qualquer (ex: `painel`) e clique em **Register app**. Não precisa
     marcar "Firebase Hosting".
   - Vai aparecer um bloco de código com `const firebaseConfig = {...}`. Copie
     esses valores.
8. Abra o arquivo `js/firebase-config.js` deste projeto e substitua cada
   `'COLE_AQUI'` pelo valor correspondente que você copiou.
9. Suba esse arquivo atualizado de volta no GitHub (**Add file > Upload files**,
   selecione só o `firebase-config.js`, confirme a substituição).

Pronto — em 1-2 minutos o site publicado no Pages já estará funcionando com
login e banco de dados de verdade.

### Parte C — Aviso importante sobre privacidade

O link do GitHub Pages é **público**: qualquer pessoa com a URL consegue abrir
a página de login. Isso não é um problema, porque **sem login não dá para ver
nenhum dado** — as regras do Firestore (Parte B, passo 6) bloqueiam qualquer
leitura de quem não estiver autenticado. Ainda assim:

- Não compartilhe o link fora da empresa sem necessidade.
- Só cadastre e-mails de pessoas de confiança no Firebase Authentication.
- Nunca suba os arquivos CSV originais (com nome/endereço de clientes) para
  o repositório do GitHub — eles só devem passar pelo upload dentro do painel,
  que processa tudo no navegador e só guarda os totais calculados.

### Parte D — Uso do dia a dia

1. Acesse o link do painel e faça login.
2. Na seção **Atualizar dados**, preencha a referência (ex: `09-2026`), selecione
   o CSV da Fatura de Ciclo e o do Serviço Avulso do dia, e clique em **Processar**.
3. Confira os números calculados nos cards e tabelas acima.
4. Se estiver tudo certo, clique em **Publicar para todos**. A partir daí,
   qualquer pessoa que abrir o painel (mesmo sem fazer upload) verá esse resumo.

---

## Sobre a categorização de rubricas

O arquivo `js/categorization.js` contém as regras de negócio:
- Quais rubricas da Fatura de Ciclo contam como Faturamento (Água/Esgoto) e
  quais contam como Cancelamento.
- O de-para completo de rubrica → categoria de Indireta (Corte, Religação, LNA,
  LNE, Sanção, Outros), extraído fielmente da aba "Apoio" da planilha
  `Indireta_previa_v1_ref_09.xlsx`.

Se uma rubrica nova aparecer no Serviço Avulso e não estiver nessa lista, o
painel não trava: ela é contada em "Outros" por padrão e aparece um aviso
amarelo no painel listando a rubrica não mapeada, para você adicionar no
código quando quiser.

**Sobre acentuação corrompida:** em vez de manter uma lista de variantes com
erro de codificação (como a planilha atual faz), o painel normaliza todo
texto de rubrica removendo acentos e símbolos antes de comparar. Isso faz a
versão certa e a versão corrompida da mesma rubrica caírem na mesma
categoria automaticamente, sem manutenção manual.

---

## Estrutura do projeto

```
painel-faturamento/
├── index.html              Página única do painel
├── css/styles.css          Estilos
├── js/
│   ├── firebase-config.js  Suas credenciais do Firebase (editar)
│   ├── auth.js             Login/logout
│   ├── storage.js          Leitura/gravação no Firestore
│   ├── parsers.js          Leitura dos CSVs
│   ├── categorization.js   Regras de negócio (rubrica -> categoria)
│   ├── calculations.js     Cálculo dos totais
│   └── app.js               Orquestração da interface
├── firestore.rules         Regras de segurança (colar no Console do Firebase)
└── README.md
```

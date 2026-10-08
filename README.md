# Painel de Faturamento

Painel web para consolidar o faturamento (Água/Esgoto), Cancelamento e
Indiretas (Serviço Avulso), a partir dos CSVs exportados diariamente.
Roda inteiramente no navegador (nenhum servidor pra manter) e usa o
Firebase só para guardar os totais calculados e controlar o acesso.

**O que o painel faz hoje:**
- Acesso restrito a uma lista de e-mails, com "Primeiro acesso" (a pessoa cria
  a própria senha) e confirmação do e-mail por link
- Upload da Fatura de Ciclo, Serviço Avulso e Consumo do ciclo atual
- Cálculo de Faturamento Água/Esgoto, Cancelamento, Indiretas por categoria
  (Corte, Religação, LNA, LNE, Sanção, Outros) e indicadores (economias,
  volume, tarifa média, ticket médio)
- DRE com Orçado RF/Sup editável e salvo por referência
- Revisão de "Em Análise" com ajuste para o valor mínimo tarifário
- Comparativo com o mês anterior
- Publicação: quem sobe os arquivos clica em "Publicar" e toda a equipe
  passa a ver esse resumo

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
4. **Quem pode acessar** é definido pela lista de e-mails no arquivo
   `firestore.rules` (passo 6). Não é preciso criar usuários no Console: cada
   pessoa da lista entra no painel, clica em **Primeiro acesso**, cria a senha
   e confirma o e-mail pelo link que recebe. Só depois disso ela vê os dados.
5. **Criar o banco de dados (Firestore):**
   - No menu lateral, vá em **Build > Firestore Database**.
   - Clique em **Create database**. Escolha a localização mais próxima
     (ex: `southamerica-east1` — São Paulo). Comece em **modo de produção**.
6. **Configurar as regras de segurança e a lista de e-mails:**
   - Abra o arquivo `firestore.rules` deste projeto e troque os e-mails de
     exemplo pelos da equipe (minúsculas, entre aspas simples, separados por
     vírgula, sem vírgula depois do último).
   - Na aba **Rules** do Firestore, apague o conteúdo, cole o arquivo editado
     e clique em **Publish**.
   - Para incluir ou tirar alguém depois, repita este passo. Vale na hora.
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

### Parte C — Privacidade e LGPD

O link do GitHub Pages é **público**: qualquer pessoa com a URL consegue abrir
a página de login e ler o código. Isso não expõe dados: as regras do Firestore
só liberam leitura e gravação para os e-mails da lista, e só depois que a
pessoa confirmou o e-mail. Quem estiver fora da lista, mesmo com conta, vê a
mensagem de acesso negado.

Os CSVs são lidos e calculados **no navegador** de quem faz o upload e não são
enviados a lugar nenhum. No Firestore ficam só os totais (por ciclo,
localidade e categoria), os nomes de rubricas não mapeadas e o e-mail de
quem publicou. Nomes de clientes e números de ligação aparecem na tela de
"Em Análise", mas não são salvos.

- Só inclua na lista e-mails de pessoas de confiança.
- Nunca suba os CSVs originais (com nome/endereço de clientes) para o
  repositório do GitHub.
- Valide o uso com o encarregado de dados (DPO) da empresa.

### Parte D — Uso do dia a dia

1. Acesse o link do painel e faça login (no primeiro uso, "Primeiro acesso").
2. Em **Atualizar dados**, preencha a referência (ex: `09-2026`), selecione os
   três CSVs do dia e clique em **Processar**.
3. Revise o "Em Análise", se for o caso, e confira os números.
4. Clique em **Publicar para todos**.

**Comparativo com o mês anterior:** o painel compara o mês exibido com o mês
anterior salvo. Quando um mês já foi publicado no painel, ele vira
automaticamente a base de comparação do mês seguinte, então só é preciso
subir manualmente um mês que nunca foi publicado (pelo próprio bloco do
comparativo, com os três arquivos do mês fechado). Importante: vale a
**última publicação** de cada mês, então publique os arquivos finais do mês
antes de começar o mês seguinte.

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
│   ├── auth.js             Login, primeiro acesso e confirmação de e-mail
│   ├── storage.js          Leitura/gravação no Firestore
│   ├── parsers.js          Leitura dos CSVs
│   ├── categorization.js   Regras de negócio (rubrica -> categoria)
│   ├── calculations.js     Cálculo dos totais e do comparativo
│   ├── tarifas.js          Tarifa progressiva (valor mínimo do Em Análise)
│   ├── dre.js              Linhas do DRE
│   └── app.js               Orquestração da interface
├── firestore.rules         Regras de segurança + lista de e-mails (colar no Console)
└── README.md
```

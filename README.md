# Achei Vaga — Sistema para Estacionamentos

SaaS de controle de estacionamento: registra entrada e saída de veículos,
calcula o valor, controla mensalistas e fecha o caixa do dia.

Um mesmo sistema atende **vários estacionamentos assinantes**. Cada um enxerga
somente os próprios dados.

- **No ar:** https://mesquitaigorsaas.github.io/estacionamento/
- **Banco e login:** Supabase (projeto `Achei Vaga`)

---

## Rodar no seu computador

Precisa do Node instalado. Na pasta do projeto:

```
npx http-server -p 4173 -c-1
```

Depois abra `http://localhost:4173`.

> Não use `npx serve`: ele remove o `.html` dos endereços e, no caminho, apaga os
> filtros passados na URL (`?status=aberta`). Os cartões da tela inicial param de
> funcionar só no teste local, dando a impressão errada de que há um bug.

Abrir o `index.html` com dois cliques **não funciona**: o navegador bloqueia a
conversa com o Supabase em endereços `file://`, e o login falha.

---

## Publicar

O site sobe pelo Git. Da pasta do projeto:

```
git add . ; git commit -m "o que mudou"
git push
```

O GitHub Pages reconstrói sozinho, leva cerca de 1 minuto.

**Exceção importante:** a Edge Function (`supabase/functions/admin-usuarios`)
**não** sobe pelo `git push`. Ela roda dentro do Supabase e precisa ser publicada
lá, em *Edge Functions → admin-usuarios → editar código → Deploy*. O arquivo no
repositório é apenas a cópia versionada.

---

## Como o projeto está organizado

| Pasta | O que tem |
|---|---|
| raiz (`*.html`) | uma página por tela do sistema |
| `js/` | um arquivo por página, com o mesmo nome |
| `js/services/` | conversas com o banco (buscar, gravar) |
| `js/utils/` | funções reaproveitadas: datas, cálculos, formatação |
| `components/` | cabeçalho, menu e modal, injetados em toda página |
| `css/` | `style.css` é a base; o resto é por área |
| `supabase/` | scripts SQL e a Edge Function |

Toda página interna começa igual: `exigirLogin()` para checar a sessão, e
`montarShell()` para desenhar menu e cabeçalho.

---

## Perfis de acesso

| Perfil | Vê |
|---|---|
| `administrador` | tudo, incluindo Financeiro, Relatórios, Usuários e Configurações |
| `gerente`, `operador` | operação do dia a dia; **não** vê dinheiro nem configuração |

A restrição é feita em dois lugares: o menu esconde o item, e a própria página
chama `exigirPerfil()` e devolve quem não pode para a tela inicial — senão
bastaria digitar o endereço no navegador.

---

## Cuidados que já custaram bug

**Datas.** Sempre use `js/utils/datas.js` para montar filtros de período. Mandar
`'2026-08-15T23:59:59'` direto na consulta faz o banco entender como UTC, e todo
movimento depois das 21h some dos relatórios.

**Somar meses.** Use `somarMeses()`. O `setMonth` do JavaScript transforma
31/jan + 1 mês em 3 de março, pulando fevereiro.

**Valores.** O preço de cada estacionamento vive na tabela `estacionamentos`
(`valor_bloco`, `minutos_bloco`, `valor_diaria`). O cálculo é sempre por
`calcularValor()` — inclusive na prévia da tela de Configurações, para a
estimativa nunca divergir do que é cobrado de verdade.

**Chaves.** A chave do Supabase no `js/supabase.js` é a pública, feita para ficar
no navegador. A chave secreta só existe dentro da Edge Function, nunca aqui.

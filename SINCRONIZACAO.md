# SIGEN · Base de dados partilhada e sincronização

As duas apps — **SIGEN Exames** (repo `Exames-School`) e **SIGEN Classificações**
(repo `Exames-Classifica-es`) — usam **a mesma base de dados** Supabase (Postgres),
projeto `sigen-exames` (`https://wwfqrwfyucmetxkrkhmm.supabase.co`, região eu-west-1).
Este ficheiro é igual nos dois repositórios.

## O que fica partilhado

| Tabela | Conteúdo | Quem escreve |
|---|---|---|
| `instituicoes` | Agrupamentos e escolas (C03) | as duas apps |
| `utilizadores` | Contas e perfis (C04) | as duas apps |
| `notificacoes` | Avisos e comunicações (C06) | as duas apps + gatilhos |
| `auditoria` | Registo de auditoria (C07) | as duas apps |
| `incidentes_privacidade` | Incidentes RGPD (C07) | as duas apps |
| `alunos` | Alunos (E01) | SIGEN Exames |
| `provas` | Catálogo de provas e sessões (E11) | SIGEN Exames |
| `registos` | Restantes coleções de cada app (JSON), separadas por `app` e `colecao` | cada app as suas |

Vistas de consulta: `v_inscricoes`, `v_presencas`, `v_resultados`.

Perfis: cada app só vê os perfis que conhece. `VIGILANTE` só aparece no Exames;
`CLASSIFICADOR` e `CONFERENTE` só nas Classificações. O EE/aluno maior é
`EE_ALUNO` na base de dados (`EE_ALUNO_MAIOR` no Exames, `ALUNO_EE` nas Classificações).

## O que passa automaticamente de uma app para a outra

Feito por gatilhos na própria base de dados (`supabase/migrations/…_sigen_sync_triggers.sql`),
por isso funciona mesmo que a outra app esteja fechada:

1. **Exames → Classificações — sessão de prova fechada (E19)**
   - aluno *Presente* / *Atraso tolerado* → código anónimo (K03) e lote de provas
     recebido (K01) com a quantidade de provas realizadas;
   - aluno com *Falta* → resultado **"Faltou"** pendente de validação (K09).
2. **Exames → Classificações — catálogo de provas (E11)** → datas de exame no
   calendário das Classificações (C05) para o mesmo ano letivo e fase.
3. **Exames → Classificações — calendário (C05)** → prazos de inscrição e estado.
4. **Classificações → Exames — resultado publicado** → notificação ao
   encarregado de educação / aluno, visível em C06 nas duas apps.

Registos criados pelos gatilhos têm id `sync-…` e a coluna `origem_sync` preenchida.

## Módulo ENES/ENEB e Ficha ENES (adenda SIGEN 04)

| Ecrã | App | O que faz |
|---|---|---|
| EN01 | Classificações | Formatos de ficheiro versionados (origem, versão, codificação, delimitador, cabeçalhos, mapa de colunas, regras). Rascunho → Em validação → Ativo (testes) → Homologado. Só formatos homologados servem para produção. |
| EN02 | Classificações | Importação de ficheiros ENES/ENEB: valida tipo, tamanho, codificação, colunas, duplicados, prova, escola, fase e classificações (0–200, Faltou, Anulada). Gera um SHA-256 de cada ficheiro e recusa ficheiros idênticos já importados. A importação é atómica e a anulação de um lote é justificada e reverte o que já tinha sido aplicado. |
| EN03 | Classificações | Reconciliação: correspondente / divergente / sem correspondência. Nada é alterado sem decisão justificada; substituir uma classificação validada ou publicada exige Coordenação ou Admin central e cria nova versão no histórico do resultado. |
| EN04 | Exames | Pedido de Ficha ENES (complementa o E10). Faz a verificação de dados e de documentos, pede os documentos em falta ao EE com um aviso sem dados pessoais, e trata da submissão, validação, devolução e encerramento. Quem submete não pode validar. |
| EN05 | Exames | Minuta com marca de água **NÃO OFICIAL**, com os resultados validados ou publicados que vêm das Classificações. Circuito: conferência → aprovação interna (por três pessoas diferentes) → registo da referência de emissão oficial externa. O botão "Emitir Ficha ENES oficial" está bloqueado (`FICHA_ENES_EMISSAO_OFICIAL_AUTORIZADA = false`). |
| EN06 | Exames | Versões, autores, revisores, referências externas, substituições, prazo de conservação e exportação de auditoria. O Auditor/EPD só lê. |

Dependências externas antes de uso oficial (§10): especificação oficial ou amostra autorizada
dos ficheiros ENES/ENEB, modelo e circuito oficial da Ficha ENES, e validação com a escola e com o JNE.
O formato incluído (`SIGEN-TESTE-1.0`) é **só de testes**.

## Como funciona nas apps

- `src/sync/engine.ts` (igual nas duas apps): ao arrancar carrega tudo da base
  de dados; cada alteração local é enviada (só o que mudou); alterações feitas
  noutro lado chegam em **tempo real** (Supabase Realtime).
- `src/sync/bindings.ts`: conversão entre o formato de cada app e as tabelas.
- `src/sync/config.ts`: URL e chave pública. Pode ser substituído por
  `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`; `VITE_SIGEN_SYNC=off` volta a
  funcionar só com `localStorage`.
- Indicador no cabeçalho: *Sincronizado*, *A guardar…*, *Sem ligação (local)*, *Erro*.
  Sem ligação a app continua a funcionar localmente e volta a tentar a cada 15 s.

## Autenticação e acesso (segurança)

- **Login real (Supabase Auth)**, a mesma conta serve as duas apps conforme o perfil.
  1. email + palavra-passe;
  2. **MFA TOTP** (Google/Microsoft Authenticator, Authy…) para contas com MFA ativo —
     configurado com código QR no 1.º acesso;
  3. **troca obrigatória** da palavra-passe temporária.
  Só com os três passos cumpridos a base de dados devolve dados.
- **Acesso por escola e por perfil, imposto pela base de dados (RLS)**, não pela app:
  - sem sessão não se lê nada (o papel anónimo não tem acesso a nenhuma tabela);
  - conta Suspensa ou fora da vigência não vê nada;
  - cada utilizador só vê as escolas em `escola_ids` (Admin central: todas);
  - EE / aluno maior só vê os seus educandos (ligados em E03 ou por `aluno_refs`),
    resultados **publicados** e calendários publicados;
  - a correspondência código anónimo ↔ aluno só é visível à Direção e ao Admin central;
  - Auditor/EPD só lê; ninguém altera o seu próprio perfil, escolas ou estado;
  - a auditoria só aceita novos registos (não se altera nem apaga) e o autor é
    carimbado pelo servidor.
- **C04** — "Palavra-passe temporária" e "Repor MFA" usam a função de servidor
  `sigen-contas` (só administradores). A palavra-passe temporária é mostrada uma vez.
- Com a base de dados ligada, nada dos dados fica guardado no browser (só a sessão);
  ao sair, a cópia local é apagada. "Recarregar dados do servidor" nunca apaga nada.
- Contas de exemplo: palavra-passe inicial `Sigen2026!` (troca obrigatória no 1.º acesso).

## Instalar de raiz noutro projeto Supabase

1. Executar, por ordem, os ficheiros de `supabase/migrations/` no SQL editor.
2. Publicar a função `supabase/functions/sigen-contas` (`supabase functions deploy sigen-contas`).
3. Carregar os dados de exemplo e criar as contas — primeiro o Exames, depois as Classificações
   (a chave `service_role` está em Project Settings > API; use-a só no seu computador):
   ```bash
   SUPABASE_SERVICE_ROLE_KEY=... npm run db:seed
   ```
4. Definir `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` nas duas apps.


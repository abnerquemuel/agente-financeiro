# Configurar login com CPF e senha

O site usa Supabase para autenticação e banco de dados. A senha não é salva no código do site: ela fica protegida pelo Supabase Auth.

## 1. Criar projeto

1. Entre em https://supabase.com.
2. Crie um projeto novo.
3. No painel do projeto, abra **SQL Editor**.
4. Cole e execute o conteúdo de `database.sql`.

## 2. Desativar confirmação de e-mail

Como o login do app usa CPF, o código cria um e-mail técnico interno a partir do CPF. Para o cadastro entrar direto:

1. Vá em **Authentication > Providers > Email**.
2. Desative **Confirm email**.
3. Salve.

## 3. Conectar o site ao Supabase

1. Vá em **Project Settings > API**.
2. Copie a **Project URL**.
3. Copie a chave **anon public**.
4. Abra `supabase-config.js`.
5. Troque os valores:

```js
window.AGENTE_SUPABASE = {
  url: "SUA_PROJECT_URL",
  anonKey: "SUA_ANON_PUBLIC_KEY"
};
```

Depois disso, faça commit e push. O site passará a pedir CPF e senha.

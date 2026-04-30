# placar-tenis
App de marcação de placar de jogo de tênis feito por um pai babão.

Placar de Tênis - v5:
- Adicionado banner de instalação no iPhone quando aberto fora do modo standalone.
- O banner orienta: Safari > Compartilhar > Adicionar à Tela de Início.
- Não altera o motor de pontuação nem os relatórios da v4.

Placar de Tênis - v4:

Base: v3.
Alteração:
- Mantido o motor de placar.
- Relatório refatorado e melhor formatado.
- Dois botões:
  - Copiar resumo
  - Copiar completo

Inclui:
- tie-break normal
- tie-breakão decisivo
- erro de saque / dupla falta automática
- estatísticas de saque
- overlay em tela cheia
- PWA com ícones

Para atualizar no iPhone:
1. Publique os arquivos.
2. Apague o app antigo da Tela de Início.
3. Abra no Safari.
4. Adicione novamente à Tela de Início.

Placar de Tênis - v3:

Inclui:
- motor com set por diferença de 2 games ou tie-break no empate limite
- tie-break normal até 7 pontos, diferença mínima de 2
- tie-breakão decisivo até 10 pontos, diferença mínima de 2
- saque correto em tie-break: primeiro ponto, depois alternância a cada 2 pontos
- botão Erro Saque
- 1º saque / 2º saque visual no card do sacador
- dupla falta automática no segundo erro de saque
- estatísticas de saque
- overlay de classificação em tela cheia
- layout em paisagem
- PWA básico compatível com GitHub Pages


Para Android/Chrome:
1. Publicar via HTTPS.
2. Abrir o site.
3. Verificar se aparece "Instalar app" no menu ou na tela do app.
4. Se não aparecer, limpar dados do site no Chrome e recarregar.

# Dog Battery

Calculadora de artilharia para WARDOGS. Você cola as coordenadas do mapa (sua peça e o alvo) e ela devolve a distância para o RNG da mira e a direção para girar.

Projeto feito por fãs, sem vínculo com a BULKHEAD ou a Team17.

## O que faz

- Distância (RNG) e azimute em graus e mils a partir das coordenadas do “Mark Coordinates”.
- Aviso quando o alvo está fora do alcance do L81 ou do SPH-2.
- Correção pelo impacto: cole onde o projétil caiu e veja quanto aumentar ou diminuir o RNG e para que lado girar.
- Link da missão: gera uma URL com as coordenadas para mandar no Discord. Quem abre já vê a solução.
- Histórico local dos alvos salvos e lembrança da última posição da peça.
- Mostrador animado: a peça gira até o azimute, o alvo aparece na distância certa e o disparo é animado (respeita a opção de movimento reduzido do sistema).

## Como funciona o cálculo

O mapa do WARDOGS usa uma unidade igual a 100 m, com X crescendo para leste e Y para norte.

```
distância (m) = 100 × √((Xalvo − Xarma)² + (Yalvo − Yarma)²)
azimute       = atan2(ΔX, ΔY)   // 0° = norte, sentido horário
```

A distância é plana: o jogo não considera relevo nesse cálculo. Atirando morro acima, o RNG certo tende a ser maior; morro abaixo, menor.

## Estrutura

```
index.html
css/style.css
js/
  app.js                 controlador da página (eventos e render)
  core/fire-solution.js  cálculo de distância, azimute, alcance e correção
  core/parse.js          leitura das coordenadas coladas
  core/storage.js        localStorage e link de compartilhamento
  data/weapons.js        peças e alcances
  ui/dial.js             mostrador animado (bússola, alvo e disparo)
  ui/animate.js          números que rolam até o novo valor
```

Os alcances em `js/data/weapons.js` são medições da comunidade (L81: 50–700 m, SPH-2: 745–2.660 m). Se o jogo mudar, é só editar ali.

## Rodar localmente

O projeto usa ES modules, então abrir o `index.html` direto pelo arquivo não funciona. Suba um servidor estático na pasta:

```bash
npx serve .
# ou
python3 -m http.server 8000
```

## Publicar no GitHub Pages

1. Crie um repositório e envie os arquivos para a branch `main`.
2. No repositório, vá em **Settings → Pages**.
3. Em **Source**, escolha **Deploy from a branch**, branch `main`, pasta `/ (root)`.
4. Em um ou dois minutos o site fica em `https://SEU-USUARIO.github.io/NOME-DO-REPO/`.

O arquivo `.nojekyll` evita que o GitHub processe o site com Jekyll.

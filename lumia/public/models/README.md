# Avatar humano realista — onde e como instalar

O intérprete da LUMIA funciona com **qualquer avatar humano em GLB/GLTF** que tenha
esqueleto e blend shapes faciais. Enquanto nenhum modelo é instalado, o player usa
o **avatar de referência** gerado por código (`src/avatar/rig/proceduralAvatar.ts`) —
ele existe para validar sincronia, gramática e enquadramento, **não** para ser o
visual final.

## 1. Coloque o arquivo aqui

```
public/models/avatar.glb
```

## 2. Ative em `public/models/avatar.config.json`

```json
{
  "enabled": true,
  "url": "/models/avatar.glb",
  "heightMeters": null,
  "rotationY": 0,
  "boneAliases": {},
  "morphAliases": {},
  "invertFingerCurl": false
}
```

Recarregue o player. Se o carregamento falhar, o player avisa e volta para o avatar
de referência (nunca fica sem intérprete).

## 3. Requisitos do modelo

| Requisito | Por quê |
|---|---|
| **Esqueleto humanoide** (skeletal animation) com `Spine/Spine1/Spine2`, `Neck`, `Head`, `Left/RightArm`, `Left/RightForeArm`, `Left/RightHand` | IK dos braços, giro do tronco (incorporação de personagens), cabeça |
| **3 falanges por dedo** (`…HandIndex1..3`, `Middle`, `Ring`, `Pinky`, `Thumb`) | Configurações de mão da Libras — sem dedos não há Libras |
| **Blend shapes no padrão ARKit** (`eyeBlinkLeft`, `jawOpen`, `browInnerUp`, `browDownLeft`, `mouthSmileLeft`, `mouthFrownLeft`, `eyeWideLeft`, `eyeSquintLeft`, `mouthPucker`, `cheekPuff` …) | Expressões faciais gramaticais (perguntas, negação, tópico) e emoção |
| Opcional: ossos `LeftEye` / `RightEye` | Olhar dirigido (referência a personagens no espaço) |
| Pés na origem, olhando para **+Z** (use `rotationY` se não estiver) | Enquadramento automático |
| Roupa escura e lisa, mangas compridas | Contraste das mãos — convenção profissional de intérpretes |

Nomes reconhecidos automaticamente: Mixamo (`mixamorig:RightHand`), estilos
Unreal/MetaHuman (`hand_r`, `index_01_r`), VRM/genéricos (`RightHand`,
`RightHandIndex1`). Para outros nomes, use `boneAliases`:

```json
"boneAliases": { "RightHand": "Bip01_R_Hand", "RightHandIndex1": "Bip01_R_Finger1" }
```

Blend shapes com outros nomes: `"morphAliases": { "jawOpen": "mouthOpen" }`.
Se os dedos dobrarem para trás, ligue `"invertFingerCurl": true`.

## 4. De onde vem um avatar realista

Um humano fotorrealista **não se gera com código**: precisa de escaneamento ou
modelagem profissional, rig facial (ARKit) e rig de mãos completo. Caminhos comuns:
ferramentas de criação de personagens com exportação para GLB/FBX e blend shapes
ARKit, ou um estúdio de 3D/captura. Verifique sempre a **licença de uso comercial**
do modelo antes de publicar.

Para a interpretação ficar natural de verdade, o passo seguinte é **motion capture
de intérpretes surdos e ouvintes** (corpo, dedos e rosto). O ponto de encaixe para
clipes de mocap é `GlbRig.playClip()` em `src/avatar/rig/glbRig.ts`.

## 5. Como o rig GLB foi testado

`src/avatar/rig/glbRig.test.ts` monta um esqueleto Mixamo sintético em T-pose e
verifica que o IK leva o punho ao alvo (erro < 2 cm) e orienta a mão. Cada modelo
real pode exigir ajuste fino de aliases/eixos — isso é esperado.

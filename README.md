# NEURO-FIGHTER: Avance — Tramo 1 (Fosa de Ranvier)

Primer tramo jugable de NEURO-FIGHTER en modo avance (estilo beat 'em up): MGR-01 recorre la superficie del axón para proteger la conexión, con oleadas de agresores y MACRO-L1 como jefe final.

**Jugar:** https://xesco-tejedor.github.io/neuro-fighter-advance/

Tres archivos: `index.html`, `styles.css`, `game.js`. Sin dependencias ni assets externos; todo se dibuja y suena por código.

**Música original** generada en vivo con Web Audio (chiptune): un tema para el avance y otro más intenso para el jefe MACRO-L1. Empieza al pulsar para jugar y se silencia con M junto a los efectos.

## Controles

| Tecla | Acción |
| --- | --- |
| A / D | Mover izquierda y derecha |
| W / S | Subir y bajar en la banda de profundidad |
| Espacio | Salto |
| U | Golpe (combo encadenable x3) |
| I | Neuro-Ball (gasta energía) |
| O | Guardia |
| M | Silenciar / activar sonido |
| H | Ver cajas de colisión |

En pantallas táctiles aparecen controles en pantalla (cruceta + GOLPE, BOLA, GUARD, SALTO).

## Armas recogibles

- **ENZIMA-L**: bastón enzimático que duplica el daño del golpe y le da más alcance (10 usos).
- Se recoge pasando por encima. La dejan caer los agresores grandes (y a veces los pequeños) y hay algunas repartidas por el tramo.

## Reglas del tramo

- La barra de **CONEXIÓN** baja con el daño. Si llega a 0, el tramo se reinicia.
- Derrotar enemigos **no** restaura la conexión: solo las **recargas de señal** y los **puntos de control**.
- La cámara se bloquea en cada oleada hasta despejarla.

Versión de duelos 1 contra 1 (v5) intacta y aparte; esta es una versión nueva.

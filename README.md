# NEURO-FIGHTER: Avance — Tramos 1 y 2

Dos tramos jugables de NEURO-FIGHTER en modo avance (estilo beat 'em up): MGR-01 recorre la superficie del axón para proteger la conexión.

- **Tramo 1 · Fosa de Ranvier:** oleadas de agresores y **MACRO-L1** como jefe final.
- **Tramo 2 · Vía Periférica:** nuevas variedades de agresores, la superarma **MOTO-V** y la jefa **PLACA-0**.

**Jugar:** https://xesco-tejedor.github.io/neuro-fighter-advance/

Tres archivos: `index.html`, `styles.css`, `game.js`. Sin dependencias ni assets externos; todo se dibuja y suena por código.

**Música original** generada en vivo con Web Audio (chiptune): un tema para el avance y otro más intenso para los jefes. Empieza al pulsar para jugar y se silencia con M junto a los efectos.

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

## Armas y vehículo

- **ENZIMA-L**: bastón enzimático que duplica el daño del golpe y le da más alcance (10 usos). Se recoge pasando por encima; la dejan caer los agresores grandes y hay varias repartidas.
- **MOTO-V** (tramo 2): moto voladora que se monta pasando por encima. Durante el vuelo **arrasa a la multitud** de agresores al contacto, **U** da turbo (gasta energía) y **Espacio** salta los agregados fijos. Los golpes y obstáculos dañan su barra de integridad, no la conexión; si se rompe, sigues a pie. Al final del tramo de vuelo te deja en un punto de control.

## Agresores

- **Agresor con púas** (normal y grande): cuerpo a cuerpo clásico.
- **CITO-K**: citocina saltarina; brinca hacia ti y esquiva los golpes mientras está en el aire.
- **RADICAL-X**: rápido y frágil, zigzaguea en profundidad.
- **PLASMA-B**: mantiene la distancia y dispara glóbulos (la guardia reduce su daño).
- **MACRO-L1** (jefe, tramo 1): macrófago cuerpo a cuerpo con embestida.
- **PLACA-0** (jefa, tramo 2): agregado tóxico que dispara ráfagas de glóbulos y suelta agresores; se enfurece al quedarle poca vida.

## Reglas del avance

- La barra de **CONEXIÓN** baja con el daño. Si llega a 0, el avance vuelve a empezar.
- Derrotar enemigos **no** restaura la conexión: solo las **recargas de señal** y los **puntos de control**.
- La cámara se bloquea en cada oleada hasta despejarla.
- Al superar el tramo 1 la conexión se restablece y empieza el tramo 2 (la ENZIMA-L que lleves te acompaña).

Versión de duelos 1 contra 1 (v5) intacta y aparte; esta es una versión nueva.

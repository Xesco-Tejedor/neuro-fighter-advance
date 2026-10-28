# NEURO-FIGHTER: Avance — Tramos 1 y 2

Dos tramos jugables de NEURO-FIGHTER en modo avance (estilo beat 'em up): MGR-01 recorre la superficie del axón para proteger la conexión.

- **Tramo 1 · Fosa de Ranvier:** oleadas de agresores y **MACRO-L1** como jefe final.
- **Tramo 2 · Vía Periférica:** nuevas variedades de agresores, la superarma **MOTO-V** (pista de neón con rivales y estelas) y la jefa **PLACA-0**.

**Jugar:** https://xesco-tejedor.github.io/neuro-fighter-advance/

Tres archivos: `index.html`, `styles.css`, `game.js`. Sin dependencias ni assets externos; todo se dibuja y suena por código.

**Cinemática inicial** estilo recreativa: al cargar, una secuencia de escenas originales presenta el argumento (MGR-01, las defensas confundidas, la conexión entre neuronas). Se salta con cualquier tecla o toque; si nadie juega, vuelve a reproducirse como una máquina en espera.

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
- **MOTO-V** (tramo 2): moto de luz futurista (silueta baja, ruedas luminosas), de diseño propio e inspirada en el género ciberpunk. Se monta pasando por encima y inicia la **pista de neón**, un tramo mucho más largo con su propia música sintética. **Espacio** salta las barreras de neón y las estelas, **U** da turbo (gasta energía) y arrasa a los agresores al contacto. Los **rivales de luz** vienen de frente dejando una **estela roja** que daña la moto; tu propia **estela cian** les corta el paso (¡CORTE!) y también puedes embestirlos. Hay anillos verdes que reparan la integridad. Los golpes y obstáculos dañan la barra de integridad, no la conexión; si se rompe, sigues a pie. Al final de la pista te deja en un punto de control.

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

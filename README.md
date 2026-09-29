# 🦴 Mandíbula 3D · Biomecánica paso a paso

Herramienta educativa e interactiva para entender la **estática de la mandíbula de un mamífero genérico**, como modelo de biomecánica animal. Calcula la fuerza de mordida y las reacciones en las dos articulaciones temporomandibulares (ATM) a partir de las fuerzas musculares, y muestra **toda la matemática paso a paso con los números actuales**.

Hecha con HTML, CSS y JavaScript (ES Modules), **Three.js** (r170) y **KaTeX**, sin paso de compilación. Disponible en **español e inglés** (selector ES/EN en la cabecera).

## Qué se puede hacer

- Elegir el diente con que se muerde (clic en la arcada, en un diente del modelo 3D o en la gráfica), la dirección de la reacción y la apertura bucal θ.
- Ajustar la fuerza, la activación y las coordenadas de 4 pares de músculos (masetero, temporal, pterigoideo medial y lateral), con simetría enlazable.
- Cargar escenarios de ejemplo: mordida incisal, molar, lado de balance reducido, distracción articular y boca abierta.
- Ver la **fuerza según la posición de mordida**, el **aporte de cada músculo** al momento de cierre (F·b) y el **triángulo de soporte** de Greaves.
- Seguir la memoria de cálculo en 10 pasos. Al pasar el ratón por un paso se resaltan en 3D los elementos que intervienen, y en los pasos 3 y 4 se dibujan los brazos de momento.

## El modelo

Sistema de referencia: origen en el punto medio entre cóndilos, **X** lateral (+ derecha del animal), **Y** anterior y **Z** superior. Los cóndilos están en $[\mp w, 0, 0]$, sobre el eje de bisagra X.

Incógnitas: $F_B$ (1), $\vec F_{JI}$ (3) y $\vec F_{JD}$ (3), es decir, 7. Ecuaciones: $\sum\vec F=0$ y $\sum\vec\tau=0$, es decir, 6. Se añade el supuesto $F_{JI,x}=F_{JD,x}$.

1. Músculos: $\hat u_i = \frac{\vec o_i-\vec r_i}{\|\vec o_i-\vec r_i\|}$, $\vec F_i = F_i\hat u_i$, $\vec\tau_i=\vec r_i\times\vec F_i$.
2. **Momento en X** (las ATM no intervienen porque están sobre el eje): $F_B = \dfrac{-T_{m,x}}{y_B u_{Bz}-z_B u_{By}}$. Con mordida vertical se reduce a $F_B = \sum F_i b_i / y_B$ (ley de la palanca).
3. Lo que deben aportar las ATM: $\vec F_{net} = -(\vec R+\vec F_B)$ y $\vec\tau_{net} = -(\vec T_m+\vec\tau_B)$.
4. Reacciones:
   - $F_{JI,z} = \tfrac12(F_{net,z} + \tau_{net,y}/w)$, $F_{JD,z} = \tfrac12(F_{net,z} - \tau_{net,y}/w)$
   - $F_{JI,y} = \tfrac12(F_{net,y} - \tau_{net,z}/w)$, $F_{JD,y} = \tfrac12(F_{net,y} + \tau_{net,z}/w)$
   - $F_{JI,x} = F_{JD,x} = \tfrac12F_{net,x}$
5. Verificación: los residuos de $\sum\vec F$ y $\sum\vec\tau$ se muestran en pantalla y deben ser ≈ 0.

$F_z<0$ en una ATM significa compresión (físicamente posible). $F_z>0$ significa distracción: la articulación tendría que tirar.

## Estructura

| Archivo | Rol |
|---|---|
| `index.html` | Estructura, textos de los pasos y conceptos |
| `styles.css` | Tema claro/oscuro (sigue al sistema) y diseño responsive |
| `app.js` | Estado, bucle de render y conexión entre módulos |
| `modules/math.js` | Vectores y `solveStatics()`: el solver puro |
| `modules/model.js` | Anatomía de referencia, músculos, arcada dental, pose y escenarios |
| `modules/viewer.js` | Escena Three.js (eje Z hacia arriba, objetos reutilizados sin fugas de memoria) |
| `modules/steps.js` | Memoria de cálculo en KaTeX con valores en vivo |
| `modules/charts.js` | Gráficas SVG (barrido por la arcada, triángulo de soporte) |
| `modules/ui.js` | Controles y paneles de resultados |
| `modules/i18n.js` | Traducción: `t(clave, vars)`, formato numérico y atributos `data-i18n` |
| `modules/locales/es.js`, `en.js` | Todos los textos visibles (HTML y KaTeX), uno por idioma |
| `tests/math.test.mjs` | Tests del solver (equilibrio, simetría, palanca, Greaves) |

## Idiomas

Todo el texto visible está en `modules/locales/es.js` y `modules/locales/en.js`, con las mismas claves. En el HTML, `data-i18n="clave"` rellena el contenido del elemento y `data-i18n-attr="title:clave"` rellena atributos. En JS se usa `t('clave', { var })`. Los subíndices cambian con el idioma (F<sub>JI</sub>/F<sub>JD</sub> ↔ F<sub>JL</sub>/F<sub>JR</sub>). El idioma se detecta del navegador y la elección se guarda en `localStorage`.

Para añadir otro idioma basta con copiar `en.js`, traducir los valores y registrarlo en `modules/i18n.js`.

## Ejecutar

```bash
python3 -m http.server 8080   # y abrir http://localhost:8080
npm test                      # o: node --test tests/*.test.mjs  (Node ≥ 18)
```

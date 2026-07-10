# 🦷 Simulador Biomecánico de la Mandíbula Humana en 3D

Este es un micrositio educativo e interactivo diseñado para simular y analizar de forma tridimensional la **biomecánica de la mandíbula humana**. La aplicación utiliza física de **equilibrio estático de cuerpo rígido** para calcular la fuerza reactiva de mordida y las fuerzas de reacción en la articulación temporomandibular (ATM) a partir de los vectores de tracción muscular.

Desarrollado con **HTML5, CSS3, Three.js y KaTeX** (para el renderizado dinámico de fórmulas matemáticas en tiempo real).

---


## 🛠️ Estructura del Código del Proyecto

La aplicación está diseñada de forma modular bajo la especificación de **JavaScript moderno (ES Modules)**:

* **`index.html`:** Contiene el diseño y la estructura del dashboard dividida en el panel de parámetros (sliders de músculos y geometría), el visor interactivo en 3D, y el panel derecho con las pestañas de **Resultados**, **Memoria de Cálculo** (KaTeX) y el **Glosario Biomecánico**.
* **`styles.css`:** Define el diseño visual premium en modo oscuro/claro, la distribución flexible (Flexbox), las alertas físicas de advertencia y las tarjetas con sombreado de cristal del glosario.
* **`app.js`:** Es el orquestador principal de la aplicación. Gestiona el estado de los parámetros, captura eventos del DOM y coordina las actualizaciones de los componentes de física y gráficos 3D.
* **`modules/math.js`:** El motor matemático del simulador. Implementa el resolvedor biomecánico puro `solveBiomechanics(state)` para calcular las fuerzas de mordida y ATM utilizando sistemas lineales tridimensionales y álgebra de vectores.
* **`modules/viewer.js`:** Controla todo el entorno gráfico de **Three.js** (luces, cámara, render de la mandíbula, visualización de vectores en flechas de colores, control de ejes y selección por Raycasting).
* **`modules/ui.js`:** Administra la reactividad de la interfaz, el redibujado de sliders al cambiar proporciones, el formateo numérico y la inyección dinámica de ecuaciones desglosadas KaTeX.

---

## 🧮 Ecuaciones Biomecánicas del Simulador

El motor físico de la aplicación resuelve el sistema tridimensional de fuerzas y torques tomando el cóndilo ATM izquierdo como el origen del sistema de referencia $[0, 0, 0]$:

### 1. Fuerzas y Torques Musculares
Para cada músculo activo $i$:
* Vector de tracción unitario: $\hat{u}_i = \frac{\vec{origin}_i - \vec{r}_i}{\|\vec{origin}_i - \vec{r}_i\|}$
* Fuerza vectorial: $\vec{F}_i = F_i \cdot \hat{u}_i$
* Torque muscular sobre el origen: $\vec{\tau}_i = \vec{r}_i \times \vec{F}_i$

### 2. Fuerza de Mordida ($\vec{F}_B$)
Resolviendo para el torque sobre el eje principal de rotación (bisagra, Eje X):
$$F_B = \frac{-T_x}{y_B u_{Bz} - z_B u_{By}}$$
Donde $T_x$ es el torque neto de todos los músculos elevadores sobre el eje X.

### 3. Fuerzas de Reacción Condilares ($\vec{F}_{JL}, \vec{F}_{JR}$)
Balanceando las fuerzas y torques residuales mediante las articulaciones izquierda ($L$) y derecha ($R$) separadas por el ancho intercondilar $2w$:
* **Fuerza Vertical (Z):** $F_{JRz} = \frac{1}{2} \left(F_{\text{net}, z} + \frac{\tau_{\text{net}, y}}{w}\right)$, $F_{JLz} = \frac{1}{2} \left(F_{\text{net}, z} - \frac{\tau_{\text{net}, y}}{w}\right)$
* **Fuerza Anteroposterior (Y):** $F_{JLy} = \frac{1}{2} \left(F_{\text{net}, y} + \frac{\tau_{\text{net}, z}}{w}\right)$, $F_{JRy} = \frac{1}{2} \left(F_{\text{net}, y} - \frac{\tau_{\text{net}, z}}{w}\right)$
* **Fuerza Lateral (X):** $F_{JLx} = F_{JRx} = \frac{1}{2} F_{\text{net}, x}$

---

## 🚀 Cómo Ejecutar el Proyecto Localmente

Para visualizar el micrositio interactivo:

1. Clonar el repositorio o descargar los archivos.
2. Iniciar un servidor HTTP local en la raíz del proyecto para permitir la carga correcta de los módulos JS (`type="module"`):
   ```bash
   # Usando Python
   python3 -m http.server 8080
   
   # O usando Node.js (npx)
   npx serve .
   ```
3. Abra su navegador web favorito y acceda a: **`http://localhost:8080/index.html`**

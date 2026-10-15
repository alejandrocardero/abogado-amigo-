# ⚖️ Abogado Amigo

**Abogado Amigo** es un asistente legal inteligente diseñado para simplificar la consulta, el monitoreo y la gestión de normativas legales en tiempo real. Utilizando Inteligencia Artificial avanzada y técnicas de RAG (*Retrieval-Augmented Generation*), la aplicación transforma documentos legales complejos en dictámenes accionables y fáciles de entender.

---

## 🚀 ¿Qué hace la App?

La aplicación actúa como un puente entre las gacetas oficiales del gobierno y el usuario. En lugar de leer cientos de páginas de boletines oficiales, **Abogado Amigo** hace lo siguiente:

1.  **Monitorea Gacetas Oficiales:** Rastrea automáticamente nuevas leyes, reformas y derogaciones en jurisdicciones seleccionadas (México, Cuba, República Dominicana).
2.  **Extrae Información Relevante:** Utiliza IA para leer PDFs y documentos, identificando automáticamente el ID de la ley, el título, los artículos afectados y su descripción.
3.  **Consulta Legal Inteligente:** Permite hacer preguntas en lenguaje natural (texto o voz) sobre la ley.
4.  **Genera Dictámenes Estructurados:** No solo responde, sino que crea un "Dictamen" que incluye:
    *   **Resumen Ejecutivo:** Una explicación sencilla de lo que significa la ley.
    *   **Fundamento Normativo:** Citas literales de los artículos para dar validez legal.
    *   **Impacto Operacional:** Qué cambios debe hacer el usuario o su empresa en la práctica.
    *   **Descargo de Responsabilidad:** Un recordatorio legal obligatorio.

---

## 🛠️ ¿Cómo funciona? (Arquitectura Técnica)

La app combina el poder de los modelos de lenguaje (LLMs) con datos locales precisos:

*   **Frontend Moderno:** Construido con **React 19**, **TypeScript** y **Tailwind CSS**. Las transiciones son fluidas gracias a **Motion**.
*   **Cerebro de IA Flexible:** Soporta tres modalidades de procesamiento:
    *   **Local (Ollama):** Para máxima privacidad, ejecutando modelos como Llama 3 o Mistral en tu propia máquina.
    *   **Nube (Gemini 2.0 Flash):** Para respuestas ultra rápidas y alta capacidad de razonamiento.
    *   **Navegador (Transformers.js):** Ejecución de modelos pequeños directamente en el cliente.
*   **Tubería de RAG (Retrieval-Augmented Generation):** 
    *   Cuando haces una pregunta, la app no "adivina". Primero busca en su base de datos local los fragmentos de leyes más relevantes (`retrieveTopK`).
    *   Luego, le entrega esos fragmentos exactos a la IA para que la respuesta esté basada en hechos y leyes reales, evitando "alucinaciones".
*   **Persistencia Local:** Guarda perfiles, historiales de chat y leyes indexadas en el almacenamiento local del navegador.

---

## 📱 Guía de Uso: Pantallas y Botones

La aplicación utiliza un diseño pensado para móviles con navegación inferior.

### 1. Inicio y Perfil (`AuthScreen`)
Al entrar, seleccionarás tu **Perfil** y tu **Jurisdicción** (MX, CU, DO). Esto configura el contexto legal y las fuentes de gacetas que la IA priorizará.

### 2. Asistente Legal (`AsistenteScreen`)
Es el corazón de la app.
*   **Campo de Texto/Voz:** Escribe tu duda o usa el botón de micrófono para hablar.
*   **Botón de Adjuntar:** Sube un archivo de texto para que la IA lo analice específicamente en esa consulta.
*   **Tarjeta de Dictamen:** La respuesta aparecerá como una tarjeta estructurada.
    *   **Botón "Copiar Cita":** Copia el fundamento legal al portapapeles.
    *   **Botón "Descargar PDF":** Exporta el dictamen completo a un documento PDF profesional.

### 3. Monitor de Gacetas (`GacetasScreen`)
Donde ocurre la vigilancia legal.
*   **Feed de Eventos:** Lista de nuevas leyes, reformas o derogaciones detectadas.
*   **Botón "Escanear Ahora":** Fuerza una búsqueda inmediata de actualizaciones en las fuentes oficiales.
*   **Filtros (Pills):** Filtra rápidamente para ver solo "Derogaciones" o "Nuevas Leyes".
*   **Validación (Human-in-the-Loop):** Los eventos detectados por la IA aparecen "En Revisión".
    *   **Botón ✅ Validar:** Confirma que la detección es correcta y la guarda en la base de conocimientos.
    *   **Botón ❌ Descartar:** Elimina la detección falsa.

### 4. Catálogo de Leyes (`LeyesScreen`)
Un buscador avanzado de todas las leyes que han sido indexadas y validadas, permitiéndote navegar por la normativa sin necesidad de chatear.

---

## ⚙️ Configuración para Desarrolladores

Si deseas ejecutar el proyecto localmente:

1.  **Variables de Entorno:**
    Crea un archivo `.env` basado en `.env.example` con tus llaves de API (Gemini/HuggingFace).

2.  **IA Local (Opcional):**
    *   Instala [Ollama](https://ollama.ai/).
    *   Descarga un modelo: `ollama pull llama3`.
    *   En la configuración de la app, asegúrate de que la URL sea `http://localhost:11434`.

3.  **Instalación:**
    ```bash
    npm install
    npm run dev
    ```

4.  **Requisitos:** Navegador moderno con soporte para **Web Speech API** (para voz) y **LocalStorage**.

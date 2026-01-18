# 🎮 Smash OBS API

Sistema de selección de escenarios para torneos de Super Smash Bros. Ultimate con sincronización en tiempo real entre tablet y OBS.

## ✨ Funcionalidades

- **Control desde tablet**: Interfaz táctil para seleccionar bans y picks
- **Overlay para OBS**: Tiles transparentes que se superponen al stream
- **Sincronización en tiempo real**: Socket.IO mantiene todo actualizado
- **Múltiples partidas simultáneas**: Usa `?match=ID` para separar setups
- **Modos de juego**: Game 1 (3-4-1) y Game 2+ (3-pick)
- **Funciones de árbitro**: Force Phase, Undo, Reset

---

## 📋 Requisitos

- **Node.js** v18+ (recomendado v20 LTS)
- **NPM** v9+
- Navegador moderno (Chrome, Edge, Firefox)
- OBS Studio con Browser Source

---

## 🚀 Instalación

```bash
# Instalar dependencias
npm install

# Iniciar servidor de desarrollo
npm run dev
```

El servidor iniciará en `http://localhost:3000`

---

## 📱 Uso

### Control (Tablet/PC)

```
http://[TU-IP]:3000/control/?match=SET1
```

- Selecciona modo: **Partida 1** o **Partida 2-5**
- Toca escenarios para banear/seleccionar
- Usa **Undo** para deshacer y **Reset** para limpiar

### Overlay (OBS)

```
http://[TU-IP]:3000/overlay/?match=SET1
```

- Los escenarios baneados aparecen como tiles en la parte inferior
- Las tiles permanecen visibles hasta hacer Reset

### Encontrar tu IP Local

**Windows:**
```powershell
ipconfig
# Buscar "IPv4 Address" (ej: 192.168.1.100)
```

**Mac/Linux:**
```bash
ifconfig | grep "inet "
# O usar: ip addr show
```

---

## 📺 Configurar OBS

### Paso 1: Añadir Browser Source

1. En OBS → **Sources** → **+** → **Browser**
2. Nombre: `Smash Overlay`
3. Configurar:

| Campo | Valor |
|-------|-------|
| **URL** | `http://[TU-IP]:3000/overlay/?match=SET1` |
| **Width** | `1920` |
| **Height** | `1080` |
| **Custom CSS** | *(dejar vacío)* |

### Paso 2: Transparencia

- El overlay ya tiene fondo transparente
- En OBS, NO es necesario configurar chroma key
- Posiciona la capa sobre tu escena de gameplay

### Consejos

- ✅ Marcar **"Shutdown source when not visible"** (ahorra recursos)
- ✅ Usar la misma `?match=` en control y overlay
- ⚠️ Si ves fondo negro, verifica la URL y refresca

---

## 🎨 Personalización

### Imágenes de Escenarios

Coloca imágenes PNG en `public/assets/stages/`:

| Escenario | Archivo |
|-----------|---------|
| Battlefield | `battlefield.png` |
| Small Battlefield | `small-battlefield.png` |
| Final Destination | `final-destination.png` |
| Smashville | `smashville.png` |
| Pokémon Stadium 2 | `ps2.png` |
| Town & City | `town-city.png` |
| Yoshi's Story | `yoshis-story.png` |
| Hollow Bastion | `hollow-bastion.png` |
| Kalos Pokémon League | `kalos.png` |

**Tamaño recomendado:** 400×225px (16:9)

### Modificar Estilos

Edita los archivos CSS:

- **Control**: `public/control/control.css`
- **Overlay**: `public/overlay/overlay.css`

Variables CSS disponibles:
```css
:root {
  --ban-color: #e74c3c;    /* Color de bans */
  --pick-color: #2ecc71;   /* Color de picks */
  --card-bg: rgba(20, 20, 35, 0.95);
}
```

### Cambiar Posición de Tiles

En `overlay.css`:
```css
.ban-history-container {
  bottom: 60px;  /* Distancia desde abajo */
  /* Cambiar a top: 60px; para arriba */
}
```

---

## 🔧 Troubleshooting

### Tablet no conecta

1. **Verificar mismo Wi-Fi**: PC y tablet deben estar en la misma red
2. **Firewall de Windows**: Ejecutar como Admin:
   ```powershell
   netsh advfirewall firewall add rule name="Smash OBS" dir=in action=allow protocol=tcp localport=3000
   ```
3. **Probar conexión**: Navegar a `http://[IP]:3000/health` desde tablet

### Overlay en negro

- Verificar URL correcta con `?match=`
- Refrescar el Browser Source en OBS
- Revisar que Width/Height sean 1920x1080

### Desincronización

- Usar mismo `?match=ID` en ambas páginas
- Presionar **Reset** en el control
- Refrescar ambas páginas

### Reset no funciona

- Confirmar el modal estilizado que aparece
- Verificar conexión (indicador verde "Connected")

---

## 📁 Estructura del Proyecto

```
smash-obs-api/
├── server.js           # Servidor Express + Socket.IO
├── package.json
├── data/
│   └── stages.json     # Lista de escenarios
└── public/
    ├── assets/stages/  # Imágenes de escenarios
    ├── control/        # UI para tablet
    │   ├── index.html
    │   ├── control.css
    │   └── control.js
    └── overlay/        # UI para OBS
        ├── index.html
        ├── overlay.css
        └── overlay.js
```

---

## 🛣️ Roadmap

Funcionalidades para futuras versiones:

- [ ] **Diferentes Rulesets**: Americano y Japones
- [ ] **Sonidos**: Efectos al banear/seleccionar
- [ ] **Temas personalizables**: Light mode, colores de torneo
- [ ] **Panel admin**: Dashboard para múltiples setups
- [ ] **Integración Start.gg**: Importar bracket automáticamente
- [ ] **PWA**: Instalar como app en tablet

---

## 📄 Licencia

MIT License - Libre para uso personal y comercial.

---

## 🙏 Créditos

Desarrollado para la comunidad de Smash Bros en España por Julio Cesar Rubio Montaño o "Coyote".

**Escenarios**: Super Smash Bros. Ultimate © Nintendo

# 🎮 BUZZ! - Juego de Pulsadores Web

## Cómo usar

### 1. Instalar dependencias
```bash
npm install
```

### 2. Arrancar el servidor
```bash
node server.js
```

### 3. Conectar jugadores
- Abre el navegador en **http://localhost:3000**
- Todos los jugadores del mismo WiFi entran a **http://TU_IP:3000**
  - Para ver tu IP: en Mac/Linux ejecuta `ifconfig`, en Windows `ipconfig`
  - Ejemplo: `http://192.168.1.50:3000`

### 4. Jugar
1. Cada jugador escribe su nombre y pulsa **UNIRSE**
2. Aparece un botón grande de color único por jugador
3. ¡El primero en pulsar gana la ronda!
4. El presentador (o cualquier jugador) pulsa **NUEVA RONDA** para resetear

## Notas
- Funciona para 2-10+ jugadores simultáneos
- Cada jugador recibe un color único automáticamente
- Al ganar aparecen confetti y el nombre del ganador en grande
- Si alguien se desconecta, desaparece de la lista automáticamente

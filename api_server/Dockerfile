# 1. Definimos la imagen base ligera de Node.js
FROM node:18-alpine

# 2. Establecemos el directorio de trabajo dentro del contenedor
WORKDIR /usr/src/app

# 3. Copiamos solo los archivos de dependencias primero (optimiza la caché de Docker)
COPY package*.json ./

# 4. Instalamos las dependencias
RUN npm install --production

# 5. Copiamos el resto del código fuente del backend
COPY . .

# 6. Exponemos el puerto en el que corre tu API
EXPOSE 3000

# 7. Comando definitivo para iniciar el servidor
CMD ["node", "server.js"]
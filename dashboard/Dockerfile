FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

# Build for production
RUN npm run build

# Preview exposes port 4173 by default, but we can configure it.
# Or just use "npm run dev" for hot reload if we wanted.
# Let's use "npm run preview" with host and port 3000
CMD ["npm", "run", "preview", "--", "--host", "--port", "3000"]

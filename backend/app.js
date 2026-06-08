// backend/app.js

import express from "express";
import helmet from "helmet";
import cors from "cors";
import morgan from "morgan";
import { rateLimit } from "express-rate-limit";
import authRoutes from "./features/auth/routes.js";
import usuariosRoutes from "./features/usuarios/routes.js";
import subestacionesRoutes from "./features/subestaciones/routes.js";
import activosRoutes from "./features/activos/routes.js";
import ordenesTrabajoRoutes from "./features/ordenes-trabajo/routes.js";
import etiquetasRoutes from "./features/etiquetas/routes.js";
import dashboardRoutes from "./features/dashboard/routes.js";
import errorHandler from "./middleware/errorHandler.js";

const app = express();

app.use(helmet());
// ALLOWED_ORIGIN vacío en dev = acepta cualquier origen; en prod: URL del frontend
app.use(cors({ origin: process.env.ALLOWED_ORIGIN || true }));
app.use(morgan("dev"));
app.use(express.json());

// Protección contra fuerza bruta solo en rutas de autenticación
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Demasiadas peticiones, inténtalo en 15 minutos" },
});

app.use("/api/v1/auth", authLimiter, authRoutes);
app.use("/api/v1/usuarios", usuariosRoutes);
app.use("/api/v1/subestaciones", subestacionesRoutes);
app.use("/api/v1/activos", activosRoutes);
app.use("/api/v1/ordenes-trabajo", ordenesTrabajoRoutes);
app.use("/api/v1/etiquetas", etiquetasRoutes);
app.use("/api/v1/dashboard", dashboardRoutes);
app.use(errorHandler);

export default app;

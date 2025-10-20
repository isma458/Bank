javascript
// server.js
import express from 'express';
import mongoose from 'mongoose';
import bodyParser from 'body-parser';
import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(bodyParser.json());

// Conexión a MongoDB
mongoose.connect(process.env.MONGODB_URI, { useNewUrlParser: true, useUnifiedTopology: true })
.then(() => console.log('Conectado a MongoDB'))
.catch(err => console.error('Error al conectar a MongoDB:', err));

// Ruta de ejemplo
app.get('/', (req, res) => {
res.send('¡Hola, mundo! Bienvenido a la API de tu aplicación.');
});

// Iniciar el servidor
app.listen(PORT, () => {
console.log(Servidor corriendo en http://localhost:${PORT});
});

3. Modelo de Usuario (Mongoose)

Crea un archivo User.js en una carpeta models para el modelo de usuario.
javascript
// models/User.js
import mongoose from 'mongoose';

const UserSchema = new mongoose.Schema({
username: { type: String, required: true, unique: true },
email: { type: String, required: true, unique: true },
password: { type: String, required: true },
});

const User = mongoose.model('User', UserSchema);
export default User;

4. Rutas de Autenticación

Crea un archivo auth.js en una carpeta routes para el manejo de autenticación.
javascript
// routes/auth.js
import express from 'express';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import bcrypt from 'bcrypt';

const router = express.Router();

// Registro de usuario
router.post('/register', async (req, res) => {
const { username, email, password } = req.body;
const hashedPassword = await bcrypt.hash(password, 10);

const newUser = new User({ username, email, password: hashedPassword });

await newUser.save();
res.status(201).json({ message: 'Usuario creado exitosamente.' });
});

// Autenticación de usuario
router.post('/login', async (req, res) => {
const { email, password } = req.body;
const user = await User.findOne({ email });

if (!user || !(await bcrypt.compare(password, user.password))) {
return res.status(401).json({ message: 'Credenciales inválidas.' });
}

const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '1h' });
res.json({ token });
});

export default router;

5. Integración del cliente con React (Frontend)

Asegúrate de tener configurado React y que hayas instalado axios para las solicitudes HTTP.
bash
npx create-react-app my-paypal-clone
cd my-paypal-clone
npm install axios
Aquí un ejemplo básico de un componente de registro:
javascript
// src/components/Register.js
import React, { useState } from 'react';
import axios from 'axios';

const Register = () => {
const [form, setForm] = useState({ username: '', email: '', password: '' });

const handleChange = (e) => {
const { name, value } = e.target;
setForm({ ...form, [name]: value });
};

const handleSubmit = async (e) => {
e.preventDefault();
try {
const response = await axios.post('http://localhost:5000/api/auth/register', form);
alert(response.data.message);
} catch (error) {
console.error('Error al registrarse:', error);
}
};

return (
<form onSubmit={handleSubmit}>
<input name="username" value={form.username} onChange={handleChange} placeholder="Username" required />
<input name="email" value={form.email} onChange={handleChange} placeholder="Email" required />
<input name="password" type="password" value={form.password} onChange={handleChange} placeholder="Password" required />
<button type="submit">Registrar);

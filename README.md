# Momo

1. **Start the Database (MongoDB):** 1 min.
MongoDB is installed as a Windows service and usually starts automatically on boot.

1. Open **MongoDB Compass**.
2. Click **Connect** to `mongodb://localhost:27017`.

*If connection fails*, open PowerShell or Command Prompt as Administrator and start the service manually:

```powershell
net start MongoDB

```

*How to verify:* MongoDB Compass opens successfully and displays your local database collection without showing connection errors.


2. **Start the Backend Server:** Terminal 1.
Open VS Code (or a terminal window) and navigate to your `server` directory:

```powershell
cd server
npx nodemon index.js

```

*How to verify:* The terminal shows Nodemon watching for changes and confirms MongoDB connection. Visiting `http://localhost:4000/health` (or your configured port) in your browser returns `{"ok": true}`.


3. **Start the Frontend Application:** Terminal 2.
Open a **second terminal tab** in VS Code (click the `+` icon in the terminal panel) and navigate to your `client` directory:

```powershell
cd client
npm run dev

```

*How to verify:* Vite outputs a local link (typically `http://localhost:5173`). Opening that link in your web browser displays your React frontend app without fetch errors.
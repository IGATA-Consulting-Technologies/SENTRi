const fs = require('fs');
const { execSync } = require('child_process');

let app = fs.readFileSync('src/App.jsx', 'utf8');

// Fix AdminRoute - remove the auth check, AdminApp handles its own auth via secret key
const oldAdminRoute = `// Admin route — requires admin role
function AdminRoute() {
  const { isAuthenticated, officer } = useAuthStore()
  if (!isAuthenticated) return <Navigate to="/login" replace />
  if (officer?.role !== 'admin') return <Navigate to="/command" replace />
  return <AdminApp />
}`;

const newAdminRoute = `// Admin route — AdminApp handles its own authentication via secret key
function AdminRoute() {
  return <AdminApp />
}`;

if (app.includes(oldAdminRoute)) {
  app = app.replace(oldAdminRoute, newAdminRoute);
  fs.writeFileSync('src/App.jsx', app, 'utf8');
  console.log('App.jsx fixed - AdminRoute now loads directly');
} else {
  // Try to find it differently
  console.log('Pattern not found exactly. Current AdminRoute:');
  const match = app.match(/\/\/ Admin route.+?return <AdminApp \/>\s*\}/s);
  if (match) console.log(match[0]);
  else console.log('Not found at all');
}

execSync('git add -A', { stdio: 'inherit' });
execSync('git commit -m "Fix admin route - AdminApp handles own auth via secret key"', { stdio: 'inherit' });
execSync('git push origin main', { stdio: 'inherit' });
console.log('Done.');

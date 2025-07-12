import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Layout } from './components/Layout';
import { Dashboard } from './pages/Dashboard';
import { Swarms } from './pages/Swarms';
import { Workers } from './pages/Workers';
import { Tasks } from './pages/Tasks';
import { Logs } from './pages/Logs';
import { Metrics } from './pages/Metrics';
import { Settings } from './pages/Settings';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Dashboard />} />
          <Route path="swarms" element={<Swarms />} />
          <Route path="workers" element={<Workers />} />
          <Route path="tasks" element={<Tasks />} />
          <Route path="logs" element={<Logs />} />
          <Route path="metrics" element={<Metrics />} />
          <Route path="settings" element={<Settings />} />
        </Route>
      </Routes>
    </Router>
  );
}

export default App;
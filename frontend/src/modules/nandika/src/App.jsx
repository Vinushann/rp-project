import { Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import HomePage from './pages/HomePage'
import VinushanPage from './modules/vinushan/VinushanPage'
import VishvaPage from './modules/vishva/VishvaPage'
import NandikaPage from './modules/nandika/NandikaPage'
import AyathmaPage from './modules/ayathma/AyathmaPage'

function App() {
  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<HomePage />} />
        <Route path="vinushan" element={<VinushanPage />} />
        <Route path="vishva" element={<VishvaPage />} />
        <Route path="nandika" element={<NandikaPage />} />
        <Route path="ayathma" element={<AyathmaPage />} />
      </Route>
    </Routes>
  )
}

export default App

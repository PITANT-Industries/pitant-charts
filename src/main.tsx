import { createRoot } from 'react-dom/client'
import '@fontsource-variable/geist'
import '@fontsource-variable/geist-mono'
import './charts.css'
import './gallery.css'
import { Gallery } from './gallery/Gallery'

const node = document.getElementById('root')
if (!node) throw new Error('Gallery root is missing')
createRoot(node).render(<Gallery />)

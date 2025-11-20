import { render } from 'preact';
import App from './App';

// Importar CSS directamente para que Bun.build() los incluya en el bundle
import '../shared/assets/main.css';
import '../shared/assets/pages.css';
import '../shared/assets/swal.css';
import './index.css';

render(<App />, document.getElementById('root'));

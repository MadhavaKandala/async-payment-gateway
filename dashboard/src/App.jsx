import { BrowserRouter, Routes, Route, Link } from 'react-router-dom';
import WebhookConfig from './pages/WebhookConfig';
import ApiDocs from './pages/ApiDocs';

const App = () => {
    return (
        <BrowserRouter>
            <div className="container">
                <nav>
                    <Link to="/webhooks">Webhooks</Link>
                    <Link to="/docs">API Docs</Link>
                </nav>
                <Routes>
                    <Route path="/" element={<WebhookConfig />} />
                    <Route path="/webhooks" element={<WebhookConfig />} />
                    <Route path="/docs" element={<ApiDocs />} />
                </Routes>
            </div>
        </BrowserRouter>
    );
};

export default App;

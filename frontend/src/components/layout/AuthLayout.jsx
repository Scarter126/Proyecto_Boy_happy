import Sidebar from './Sidebar';
import Header from './Header';

function AuthLayout({ children }) {
  return (
    <div className="authenticated-layout">
      <Sidebar />
      <div className="main-wrapper">
        <Header />
        <main className="main-content">
          {children}
        </main>
      </div>
    </div>
  );
}

export default AuthLayout;

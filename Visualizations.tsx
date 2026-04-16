
import React from 'react';
import { auth, googleProvider, signInWithPopup } from '../firebase';
import { translations, Language } from '../translations';

interface AuthProps {
  lang: Language;
}

const Auth: React.FC<AuthProps> = ({ lang }) => {
  const t = translations[lang];

  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);

  const handleLogin = async () => {
    setError(null);
    setLoading(true);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err: any) {
      console.error('Login error:', err);
      if (err.code === 'auth/popup-blocked') {
        setError('Trình duyệt đã chặn cửa sổ bật lên. Vui lòng cho phép bật lên hoặc thử lại.');
      } else if (err.code === 'auth/unauthorized-domain') {
        setError('Tên miền này chưa được cấp phép trong Firebase Console. Vui lòng thêm tên miền của ứng dụng vào danh sách Authorized Domains.');
      } else {
        setError(err.message || String(err));
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] p-4">
      <div className="bg-ai-surface p-8 rounded-3xl border border-ai-border shadow-2xl max-w-md w-full text-center space-y-6">
        <div className="w-20 h-20 bg-blue-500/10 rounded-2xl flex items-center justify-center mx-auto">
          <svg className={`w-10 h-10 text-blue-500 ${loading ? 'animate-pulse' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 00-2 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
        </div>
        <div className="space-y-2">
          <h2 className="text-2xl font-bold text-white">{t.title}</h2>
          <p className="text-ai-text-muted text-sm">{t.aiExpertDesc}</p>
        </div>

        {error && (
          <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-xs text-left space-y-2">
            <div className="flex items-center gap-2 font-bold">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Lỗi Đăng Nhập
            </div>
            <p className="break-all">{error}</p>
            <div className="pt-2 border-t border-red-500/10 text-[10px] opacity-70">
              <p>Mẹo: Nếu lỗi vẫn tiếp diễn, hãy thử:</p>
              <ul className="list-disc ml-4 mt-1">
                <li>Mở ứng dụng trong tab mới</li>
                <li>Kiểm tra kết nối mạng</li>
                <li>Đảm bảo tên miền đã được thêm vào Firebase Authorized Domains</li>
              </ul>
            </div>
          </div>
        )}

        <button
          onClick={handleLogin}
          disabled={loading}
          className={`w-full flex items-center justify-center gap-3 bg-white text-slate-900 font-bold py-4 px-6 rounded-xl transition-all shadow-lg group ${loading ? 'opacity-70 cursor-not-allowed' : 'hover:bg-slate-100'}`}
        >
          {loading ? (
            <div className="w-5 h-5 border-2 border-slate-900 border-t-transparent rounded-full animate-spin"></div>
          ) : (
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              />
            </svg>
          )}
          {loading ? 'Đang kết nối...' : t.loginWithGoogle}
        </button>
      </div>
    </div>
  );
};

export default Auth;

import { useEffect, useState } from 'react';
import { useAuth } from '../../context/authStore';
import { fetchAccessInfo } from '../../utils/api';
import { Button } from '../ui/Button';
import { Input } from '../ui/Field';
import './auth.css';

const DiscordMark = () => (
  <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden="true">
    <path d="M20.317 4.369A19.79 19.79 0 0 0 15.885 3c-.196.349-.423.819-.58 1.193a18.27 18.27 0 0 0-5.61 0A12.7 12.7 0 0 0 9.11 3a19.7 19.7 0 0 0-4.435 1.37C1.86 8.59 1.094 12.7 1.476 16.75a19.9 19.9 0 0 0 6.064 3.06c.49-.666.927-1.374 1.302-2.118a12.9 12.9 0 0 1-2.05-.984c.172-.127.34-.26.502-.397a14.2 14.2 0 0 0 12.108 0c.164.14.332.27.502.397-.654.388-1.343.72-2.05.985a13 13 0 0 0 1.301 2.117 19.8 19.8 0 0 0 6.064-3.06c.448-4.687-.766-8.76-3.205-12.382ZM8.02 14.33c-1.183 0-2.157-1.085-2.157-2.42 0-1.334.955-2.42 2.157-2.42 1.21 0 2.176 1.095 2.157 2.42 0 1.335-.955 2.42-2.157 2.42Zm7.96 0c-1.183 0-2.157-1.085-2.157-2.42 0-1.334.955-2.42 2.157-2.42 1.21 0 2.176 1.095 2.157 2.42 0 1.335-.946 2.42-2.157 2.42Z" />
  </svg>
);

/** Full-screen sign-in gate shown to anonymous users. */
export function LoginScreen() {
  const { login, error } = useAuth();
  const [access, setAccess] = useState({ subscriptionRequired: false, inviteOnly: false });
  const [code, setCode] = useState('');

  useEffect(() => {
    fetchAccessInfo().then((info) =>
      setAccess({
        subscriptionRequired: !!info.subscriptionRequired,
        inviteOnly: !!info.inviteOnly,
      })
    );
  }, []);

  const needsCode = access.subscriptionRequired || access.inviteOnly;
  const codeLabel = access.subscriptionRequired ? 'Код подписки' : 'Инвайт-код';
  const codeHint = access.subscriptionRequired
    ? 'Одноразовый код на 30 дней доступа. Если подписка ещё активна — поле можно оставить пустым.'
    : 'Код от администратора';

  const onLogin = () => login(code);

  return (
    <div className="login">
      <div className="login__card">
        <span className="login__glyph" aria-hidden="true">
          {Array.from({ length: 9 }).map((_, i) => (
            <i key={i} />
          ))}
        </span>
        <h1 className="login__title dotmatrix">Westline</h1>
        <p className="eyebrow login__sub">Discord Webhook Constructor</p>

        <p className="login__lead">
          {access.subscriptionRequired
            ? 'Войдите через Discord. Новым пользователям нужен одноразовый код подписки.'
            : 'Войдите через Discord, чтобы получить доступ к конструктору, общим пресетам и синхронизации.'}
        </p>

        {needsCode && (
          <>
            <Input
              label={codeLabel}
              value={code}
              onChange={setCode}
              placeholder="XXXXXXXX"
              mono
            />
            <p className="login__note login__note--code">{codeHint}</p>
          </>
        )}

        <Button variant="primary" block className="login__btn" onClick={onLogin}>
          <DiscordMark />
          <span>Войти через Discord</span>
        </Button>

        {error && <p className="login__error">{error}</p>}

        <p className="login__note">
          Мы запрашиваем только базовый профиль (ник и аватар).
        </p>
      </div>
    </div>
  );
}

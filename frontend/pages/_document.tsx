import { Html, Head, Main, NextScript } from 'next/document';

export default function Document() {
  return (
    <Html lang="ko">
      <Head>
        <meta charSet="utf-8" />
        <meta name="description" content="Triplan - AI 기반 여행 플래너" />
      </Head>
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}

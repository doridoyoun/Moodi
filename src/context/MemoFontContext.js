import React, { createContext, useContext } from 'react';
import { useFonts } from 'expo-font';

const MemoFontContext = createContext({
  memoFontFamily: 'System',
  fontsLoaded: false,
});

export const MemoFontProvider = ({ children }) => {
  const [fontsLoaded] = useFonts({
    NanumGomsin: require('../../assets/fonts/NanumGomsin.ttf'),
  });

  return (
    <MemoFontContext.Provider
      value={{
        memoFontFamily: fontsLoaded ? 'NanumGomsin' : 'System',
        fontsLoaded,
      }}
    >
      {children}
    </MemoFontContext.Provider>
  );
};

export const useMemoFont = () => useContext(MemoFontContext);
import { defineConfig, presetUno, presetIcons, presetWebFonts } from 'unocss'

export default defineConfig({
  presets: [
    presetUno(),
    presetIcons({
      scale: 1.2,
      cdn: 'https://esm.sh/'
    }),
    presetWebFonts({
      fonts: {
        sans: 'Inter:400,500,600,700'
      }
    })
  ],
  theme: {
    colors: {
      primary: '#6366f1',
      secondary: '#8b5cf6'
    }
  }
})

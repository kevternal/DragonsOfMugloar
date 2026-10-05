import { createApp } from 'vue'
import { createPinia } from 'pinia'

// Self-hosted fonts (OFL), served from the app's own origin.
import '@fontsource-variable/fredoka'
import '@fontsource-variable/nunito'
import './styles/tokens.css'
import './styles/base.css'
import './styles/layout.css'

import App from './App.vue'
import router from './router'

const app = createApp(App)

app.use(createPinia())
app.use(router)

// Mount after the first navigation so route meta (e.g. gameScreen) is known on first paint.
void router.isReady().then(() => app.mount('#app'))

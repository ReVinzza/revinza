const express = require('express')
const axios = require('axios')
const cheerio = require('cheerio')
const yts = require('yt-search')
const path = require('path')

const app = express()
// Gunakan port dari environment variable jika ada
const PORT = process.env.PORT || 3000

app.use(express.json())
app.use(express.urlencoded({ extended: true }))

// PERBAIKAN: Gunakan process.cwd() agar path file statis terbaca di Vercel
app.get('/', (req, res) => {
  res.sendFile(path.join(process.cwd(), 'views', 'dashboard.html'))
})

app.get('/sswa', (req, res) => {
  res.sendFile(path.join(process.cwd(), 'views', 'sswa.html'))
})

app.get('/musik', (req, res) => {
  res.sendFile(path.join(process.cwd(), 'views', 'musik.html'))
})

app.get('/tiktok', (req, res) => {
  res.sendFile(path.join(process.cwd(), 'views', 'tiktok.html'))
})

app.get('/igdl', (req, res) => {
  res.sendFile(path.join(process.cwd(), 'views', 'igdl.html'))
})

app.get('/api/sswa', async (req, res) => {
  try {
    let text = req.query.text
    if (!text) return res.status(400).send('Masukkan text')

    const battery = Math.floor(Math.random() * 30) + 70
    const carriers = ['Telkomsel', 'XL', 'Indosat', '5G']
    const carrier = carriers[Math.floor(Math.random() * carriers.length)]

    const apiURL = `https://brat.siputzx.my.id/iphone-quoted?time=09:41&batteryPercentage=${battery}&carrierName=${encodeURIComponent(carrier)}&messageText=${encodeURIComponent(text)}&emojiStyle=apple`

    const response = await axios.get(apiURL, {
      responseType: 'arraybuffer',
      timeout: 8000 // Beri timeout agar tidak menggantung lama
    })

    res.set('Content-Type', 'image/png')
    res.send(response.data)
  } catch (e) {
    console.log(e)
    res.status(500).send('Error generate SS')
  }
})

app.get('/api/play', async (req, res) => {
  try {
    let text = req.query.q
    if (!text) return res.json({ status: false, msg: 'No query' })

    let url = text
    if (!/youtu\.?be/.test(text)) {
      const search = await yts(text)
      if (!search.videos.length) return res.json({ status: false, msg: 'Tidak ditemukan' })
      const pick = search.videos[0] // Ambil hasil pertama agar lebih cepat
      url = pick.url
    }

    const api = `https://yixe.dongtube.my.id/api/downloader/savetube?url=${encodeURIComponent(url)}&format=mp3`
    const response = await axios.get(api, { timeout: 8000 })
    const data = response.data

    if (!data?.success) return res.json({ status: false, msg: 'API error' })

    const r = data.results
    res.json({
      status: true,
      title: r.title,
      cover: r.cover,
      duration: r.duration,
      download: r.download_url
    })
  } catch (e) {
    res.json({ status: false, msg: e.message })
  }
})

app.get('/api/tiktok', async (req, res) => {
  try {
    const url = req.query.url
    if (!url) return res.json({ status: false })

    const form = new URLSearchParams({ url: url, hd: 1 })
    const { data } = await axios.post('https://www.tikwm.com/api/', form.toString(), {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'Mozilla/5.0'
      },
      timeout: 8000
    })

    if (!data || data.code !== 0) return res.json({ status: false })
    const r = data.data

    if (r.play) {
      return res.json({
        status: true,
        type: 'video',
        video: r.hdplay || r.play,
        music: r.music
      })
    }

    if (r.images?.length) {
      return res.json({ status: true, type: 'image', images: r.images, music: r.music })
    }

    res.json({ status: false })
  } catch (e) {
    res.json({ status: false, msg: e.message })
  }
})

// Fungsi igdl ditaruh di luar route agar rapi
async function igdl(url) {
  try {
    const getPage = await axios.get('https://indown.io/en1', {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      timeout: 5000
    })

    const $ = cheerio.load(getPage.data)
    const token = $('input[name="_token"]').val()
    const cookies = getPage.headers['set-cookie'] ? getPage.headers['set-cookie'].map(v => v.split(';')[0]).join('; ') : ''

    const form = new URLSearchParams()
    form.append('_token', token)
    form.append('link', url)

    const result = await axios.post('https://indown.io/download', form, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Cookie': cookies,
        'User-Agent': 'Mozilla/5.0'
      },
      timeout: 8000
    })

    const $$ = cheerio.load(result.data)
    let media = null

    $$('video source').each((i, el) => { if (!media) media = $$(el).attr('src') })
    $$('img').each((i, el) => {
      const src = $$(el).attr('src')
      if (!media && src && src.startsWith('http')) media = src
    })

    if (!media) return { status: false }
    return { status: true, url: media, type: media.includes('.mp4') ? 'video' : 'image' }
  } catch (e) {
    return { status: false, msg: e.message }
  }
}

app.get('/api/igdl', async (req, res) => {
  const url = req.query.url
  if (!url) return res.json({ status: false })
  const data = await igdl(url)
  res.json(data)
})

app.get('/media', async (req, res) => {
  try {
    const url = req.query.url
    const response = await axios({
      url,
      method: 'GET',
      responseType: 'stream',
      headers: {
        'User-Agent': 'Mozilla/5.0',
        'Referer': 'https://indown.io/'
      },
      timeout: 10000
    })
    res.setHeader('Content-Type', response.headers['content-type'])
    response.data.pipe(res)
  } catch (e) {
    res.status(500).send('error media')
  }
})

// Export app untuk Vercel (penting!)
module.exports = app

app.listen(PORT, () => {
  console.log('RUNNING: http://localhost:' + PORT)
})

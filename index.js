const express = require('express');
const { PrismaClient } = require('@prisma/client');
const path = require('path');
const fetch = require('node-fetch');

const app = express();
const prisma = new PrismaClient();

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/urls', async (req, res) => {
    try {
        const urls = await prisma.url.findMany();
        res.json(urls);
    } catch (error) {
        console.error('Error fetching URLs:', error);
        res.status(500).json({ error: 'Failed to fetch URLs' });
    }
});

app.post('/api/ping', async (req, res) => {
    const { name, url } = req.body;

    try {
        const response = await fetch(url);
        const status = response.ok ? 'UP' : 'DOWN';
        const lastChecked = new Date();
        const uptime = 0; // Initialize uptime to 0 for new URLs

        const newUrl = await prisma.url.create({
            data: {
                name,
                url,
                status,
                lastChecked,
                uptime,
            },
        });

        res.json({ message: 'URL added successfully', url: newUrl });
    } catch (error) {
        console.error('Error adding URL:', error);
        res.status(500).json({ error: 'Failed to add URL' });
    }
});

app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});

// Periodic URL checking
setInterval(async () => {
    try {
        const urls = await prisma.url.findMany();
        for (const url of urls) {
            try {
                const response = await fetch(url.url);
                const newStatus = response.ok ? 'UP' : 'DOWN';
                const lastChecked = new Date();
                const uptime = newStatus === 'UP' ? url.uptime + 60 : url.uptime;

                await prisma.url.update({
                    where: { id: url.id },
                    data: { status: newStatus, lastChecked, uptime },
                });
            } catch (error) {
                console.error(`Error checking URL ${url.name}:`, error);
            }
        }
    } catch (error) {
        console.error('Error fetching URLs for periodic check:', error);
    }
}, 60000); // Check every minute

process.on('SIGINT', async () => {
    await prisma.$disconnect();
    process.exit(0);
});

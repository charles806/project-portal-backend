import prisma from '../src/config/database';

async function main() {
    try {
        console.log('Testing database connection...');
        await prisma.$connect();
        console.log('Connected successfully.');

        console.log('Checking User table...');
        const userCount = await prisma.user.count();
        console.log(`User count: ${userCount}`);

        console.log('Test complete.');
    } catch (error) {
        console.error('Database diagnostic failed:', error);
    } finally {
        await prisma.$disconnect();
    }
}

main();

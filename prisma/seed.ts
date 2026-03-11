import { prisma } from '../src/lib/prisma';

async function main() {
  await prisma.project.createMany({
    data: [
      {
        name: "Enterprise CRM Redesign",
        client: "Meridian Financial",
        description: "Full redesign of the customer relationship management platform",
        status: "active",
        progress: 68,
        dueDate: "Mar 15, 2026",
        budget: "$142,000",
        spent: "$96,560",
        tags: ["UX Design", "Development"],
      },
      {
        name: "Supply Chain Analytics",
        client: "GlobalTrade Corp",
        description: "Building real-time analytics dashboard",
        status: "active",
        progress: 42,
        dueDate: "Apr 30, 2026",
        budget: "$89,500",
        spent: "$37,590",
        tags: ["Data", "Analytics"],
      },
    ],
  });
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
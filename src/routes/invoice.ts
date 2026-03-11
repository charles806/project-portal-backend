import { Router, Response, NextFunction } from 'express';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { prisma } from '../lib/prisma';
import { UnauthorizedError, ForbiddenError, NotFoundError, BadRequestError } from '../utils/errors';

const router = Router();
router.use(authenticateToken);

// Helper: Generate invoice number
async function generateInvoiceNumber(workspaceId: string): Promise<string> {
    const year = new Date().getFullYear();
    const prefix = `INV-${year}-`;

    // Find the highest existing invoice number for this year to avoid reuse on deletion
    const latest = await prisma.invoice.findFirst({
        where: {
            workspaceId,
            invoiceNumber: { startsWith: prefix }
        },
        orderBy: { invoiceNumber: 'desc' }
    });

    let nextNum = 1;
    if (latest) {
        const parts = latest.invoiceNumber.split('-');
        const lastNum = parseInt(parts[2], 10);
        if (!isNaN(lastNum)) nextNum = lastNum + 1;
    }

    // Append a short timestamp suffix to prevent race condition collisions
    const suffix = Date.now().toString().slice(-4);
    return `${prefix}${nextNum.toString().padStart(4, '0')}-${suffix}`;
}

// Helper: Calculate invoice totals
function calculateTotals(items: any[], taxRate: number, discount: number) {
    const subtotal = items.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0);
    const taxAmount = (subtotal - discount) * (taxRate / 100);
    const total = subtotal - discount + taxAmount;
    return { subtotal, taxAmount, total };
}

// Helper: Verify workspace access
async function verifyWorkspaceAccess(workspaceId: string, userId: string) {
    const workspace = await prisma.workspace.findFirst({
        where: {
            id: workspaceId,
            OR: [
                { ownerId: userId },
                { members: { some: { userId } } }
            ]
        }
    });
    if (!workspace) throw new ForbiddenError('No access to this workspace');
    return workspace;
}

// GET /api/v1/invoices - List all invoices for workspace
router.get('/', async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
        const userId = req.user!.userId;
        const { workspaceId, status, projectId } = req.query;

        if (!workspaceId) {
            throw new BadRequestError('workspaceId is required');
        }

        await verifyWorkspaceAccess(workspaceId as string, userId);

        const where: any = { workspaceId: workspaceId as string };
        if (status) where.status = status;
        if (projectId) where.projectId = projectId;

        const invoices = await prisma.invoice.findMany({
            where,
            include: {
                project: { select: { id: true, name: true } },
                items: true,
                _count: { select: { items: true } }
            },
            orderBy: { createdAt: 'desc' }
        });

        res.json(invoices);
    } catch (error) {
        next(error);
    }
});

// POST /api/v1/invoices - Create invoice
router.post('/', async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
        const userId = req.user!.userId;
        const {
            workspaceId,
            projectId,
            clientName,
            clientEmail,
            clientAddress,
            issueDate,
            dueDate,
            taxRate,
            discount,
            notes,
            terms,
            items
        } = req.body;

        if (!workspaceId || !clientName || !dueDate || !items || items.length === 0) {
            throw new BadRequestError('Missing required fields');
        }

        await verifyWorkspaceAccess(workspaceId, userId);

        // Calculate totals
        const { subtotal, taxAmount, total } = calculateTotals(
            items,
            taxRate || 0,
            discount || 0
        );

        // Generate invoice number
        const invoiceNumber = await generateInvoiceNumber(workspaceId);

        // Create invoice with items
        const invoice = await prisma.invoice.create({
            data: {
                invoiceNumber,
                workspaceId,
                projectId: projectId || null,
                clientName,
                clientEmail: clientEmail || null,
                clientAddress: clientAddress || null,
                issueDate: issueDate ? new Date(issueDate) : new Date(),
                dueDate: new Date(dueDate),
                subtotal,
                taxRate: taxRate || 0,
                taxAmount,
                discount: discount || 0,
                total,
                notes: notes || null,
                terms: terms || null,
                status: 'DRAFT',
                items: {
                    create: items.map((item: any) => ({
                        description: item.description,
                        quantity: item.quantity,
                        unitPrice: item.unitPrice,
                        amount: item.quantity * item.unitPrice
                    }))
                }
            },
            include: {
                items: true,
                project: { select: { id: true, name: true } }
            }
        });

        res.status(201).json(invoice);
    } catch (error) {
        next(error);
    }
});

// GET /api/v1/invoices/:id - Get single invoice
router.get('/:id', async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
        const userId = req.user!.userId;
        const { id } = req.params as { id: string };

        const invoice = await prisma.invoice.findUnique({
            where: { id },
            include: {
                items: true,
                project: { select: { id: true, name: true } },
                workspace: { select: { id: true, name: true } }
            }
        });

        if (!invoice) {
            throw new NotFoundError('Invoice not found');
        }

        await verifyWorkspaceAccess(invoice.workspaceId, userId);

        res.json(invoice);
    } catch (error) {
        next(error);
    }
});

// PATCH /api/v1/invoices/:id - Update invoice
router.patch('/:id', async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
        const userId = req.user!.userId;
        const { id } = req.params as { id: string };
        const {
            clientName,
            clientEmail,
            clientAddress,
            issueDate,
            dueDate,
            taxRate,
            discount,
            notes,
            terms,
            items
        } = req.body;

        const existingInvoice = await prisma.invoice.findUnique({
            where: { id },
            include: { items: true }
        });

        if (!existingInvoice) {
            throw new NotFoundError('Invoice not found');
        }

        await verifyWorkspaceAccess(existingInvoice.workspaceId, userId);

        // Recalculate if items or tax/discount changed
        const updatedItems = items || existingInvoice.items;
        const { subtotal, taxAmount, total } = calculateTotals(
            updatedItems,
            taxRate ?? existingInvoice.taxRate,
            discount ?? existingInvoice.discount
        );

        // Update invoice
        const updateData: any = {
            clientName: clientName ?? existingInvoice.clientName,
            clientEmail: clientEmail ?? existingInvoice.clientEmail,
            clientAddress: clientAddress ?? existingInvoice.clientAddress,
            dueDate: dueDate ? new Date(dueDate) : existingInvoice.dueDate,
            taxRate: taxRate ?? existingInvoice.taxRate,
            discount: discount ?? existingInvoice.discount,
            notes: notes ?? existingInvoice.notes,
            terms: terms ?? existingInvoice.terms,
            subtotal,
            taxAmount,
            total
        };

        if (issueDate) updateData.issueDate = new Date(issueDate);

        // Update items if provided
        if (items) {
            // Delete old items, create new ones
            await prisma.invoiceItem.deleteMany({ where: { invoiceId: id } });
            updateData.items = {
                create: items.map((item: any) => ({
                    description: item.description,
                    quantity: item.quantity,
                    unitPrice: item.unitPrice,
                    amount: item.quantity * item.unitPrice
                }))
            };
        }

        const invoice = await prisma.invoice.update({
            where: { id },
            data: updateData,
            include: {
                items: true,
                project: { select: { id: true, name: true } }
            }
        });

        res.json(invoice);
    } catch (error) {
        next(error);
    }
});

// PATCH /api/v1/invoices/:id/status - Update status
router.patch('/:id/status', async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
        const userId = req.user!.userId;
        const { id } = req.params as { id: string };
        const { status } = req.body;

        const validStatuses = ['DRAFT', 'SENT', 'PAID', 'OVERDUE', 'CANCELLED'];
        if (!validStatuses.includes(status)) {
            throw new BadRequestError('Invalid status');
        }

        const existingInvoice = await prisma.invoice.findUnique({
            where: { id }
        });

        if (!existingInvoice) {
            throw new NotFoundError('Invoice not found');
        }

        await verifyWorkspaceAccess(existingInvoice.workspaceId, userId);

        const updateData: any = { status };

        // Set paidAt when marking as paid
        if (status === 'PAID' && !existingInvoice.paidAt) {
            updateData.paidAt = new Date();
        }
        // Clear paidAt if unmarking as paid
        if (status !== 'PAID' && existingInvoice.paidAt) {
            updateData.paidAt = null;
        }

        const invoice = await prisma.invoice.update({
            where: { id },
            data: updateData,
            include: {
                items: true,
                project: { select: { id: true, name: true } }
            }
        });

        res.json(invoice);
    } catch (error) {
        next(error);
    }
});

// DELETE /api/v1/invoices/:id - Delete invoice
router.delete('/:id', async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
        const userId = req.user!.userId;
        const { id } = req.params as { id: string };

        const invoice = await prisma.invoice.findUnique({
            where: { id }
        });

        if (!invoice) {
            throw new NotFoundError('Invoice not found');
        }

        // Only workspace owner can delete invoices
        const workspace = await prisma.workspace.findFirst({
            where: {
                id: invoice.workspaceId,
                ownerId: userId
            }
        });

        if (!workspace) {
            throw new ForbiddenError('Only workspace owner can delete invoices');
        }

        await prisma.invoice.delete({ where: { id } });

        res.json({ message: 'Invoice deleted successfully' });
    } catch (error) {
        next(error);
    }
});

export default router;

-- AlterTable
ALTER TABLE `Order` ADD COLUMN `archivedAt` DATETIME(3) NULL,
    ADD COLUMN `cancelReason` VARCHAR(191) NULL,
    ADD COLUMN `cancelledAt` DATETIME(3) NULL;

-- CreateTable
CREATE TABLE `husbandry_logs` (
    `id` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `note` VARCHAR(191) NOT NULL,
    `author` VARCHAR(191) NULL,
    `orderId` VARCHAR(191) NULL,

    INDEX `husbandry_logs_createdAt_idx`(`createdAt`),
    INDEX `husbandry_logs_orderId_idx`(`orderId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `Order_archivedAt_idx` ON `Order`(`archivedAt`);

-- CreateIndex
CREATE INDEX `Order_status_idx` ON `Order`(`status`);

-- CreateIndex
CREATE INDEX `Order_cancelledAt_idx` ON `Order`(`cancelledAt`);

-- AddForeignKey
ALTER TABLE `husbandry_logs` ADD CONSTRAINT `husbandry_logs_orderId_fkey` FOREIGN KEY (`orderId`) REFERENCES `Order`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

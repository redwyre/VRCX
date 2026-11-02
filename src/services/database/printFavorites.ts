import sqliteService from '../sqlite';

const printFavorites = {
    addPrintToFavorites(printId: any) {
        sqliteService.executeNonQuery(
            `INSERT OR REPLACE INTO favorite_print (print_id, created_at)
             VALUES (@print_id, @created_at)`,




            {
                '@print_id': printId,
                '@created_at': new Date().toJSON()
            }
        );
    },

    removePrintFromFavorites(printId: any) {




        sqliteService.executeNonQuery(`DELETE FROM favorite_print WHERE print_id = @print_id`, {
            '@print_id': printId
        });
    },

    async getPrintFavorites() {
        const data: { printId: any; }[] = [];

        await sqliteService.execute((dbRow: any) => {
            data.push({
                printId: dbRow[1]
            });
        }, 'SELECT * FROM favorite_print');

        return data;
    }
};

export { printFavorites };

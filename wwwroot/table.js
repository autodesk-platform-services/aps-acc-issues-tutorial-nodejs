const TABLE_TABS = {
    ISSUES: {
        REQUEST_URL: '/api/issues/issues',
        TAB_NAME: 'ISSUES',
        VISIBILITY: true,
        IMPORT_ATTRIBUTES_KEYS: [
            'id',
            'title',
            'description',
            'issueSubtypeId',
            'status',
            'dueDate',
            'assignedTo',
            'assignedToType',
            'rootCauseId',
            'published'
        ]
    },

    'USERS': {
        'REQUEST_URL': '/api/admin/projectUsers',
        'TAB_NAME': 'USERS',
        'VISIBILITY': false
    },
    'ISSUE_SUBTYPES': {
        'REQUEST_URL': '/api/issues/subtypes',
        'TAB_NAME': 'SUBTYPES',
        'VISIBILITY': false
    },
    'ISSUE_ROOTCAUSES': {
        'REQUEST_URL': '/api/issues/rootcauses',
        'TAB_NAME': 'ROOT_CAUSES',
        'VISIBILITY': false
    },
    'ISSUE_CUSTOM_ATTRIBUTES_DEFS': {
        'REQUEST_URL': '/api/issues/customAttDefs',
        'TAB_NAME': 'CUSTOM_ATTRIBUTES_DEFS',
        'VISIBILITY': false
    }
}

//////////////////////////////////////////////////////////////////////////////////////////////////////////
//Table class wraps the specific data info
class Table {
    #tableId;
    #accountId;
    #projectId;
    #tabKey;
    #dataSet;
    #maxItem;

    constructor(tableId, accountId = null, projectId = null, tabKey = 'ISSUES') {
        this.#tableId = tableId;
        this.#accountId = accountId;
        this.#projectId = projectId;
        this.#tabKey = tabKey;
        this.#dataSet = null;
        this.#maxItem = 5;
    };

    get tabKey() {
        return this.#tabKey;
    }

    set tabKey(tabKey) {
        this.#tabKey = tabKey;
    }

    resetData = async (tabKey = null, accountId = null, projectId = null) => {
        this.#tabKey = tabKey ? tabKey : this.#tabKey;
        this.#accountId = accountId ? accountId : this.#accountId;
        this.#projectId = accountId || projectId ? projectId : this.#projectId;
        const url = TABLE_TABS[this.#tabKey].REQUEST_URL;



        const data = {
            'accountId': this.#accountId,
            'projectId': this.#projectId
        }
        try {

            const response = await axios.get(url, { params: data });
            this.#dataSet = response.data;
        } catch (err) {
            console.error(err);
            return;
        }
    }




    drawTable = () => {
        // the dataset can be empty or null when 
        // 1. no records at all
        // 2. issue module is not activated with the user
        // 3. this user has no access to the data
        // 4. exceptions/errors


        let columns = [];
        for (var key in this.#dataSet[0]) {

            if (Array.isArray(this.#dataSet[0][key] && this.#dataSet[0][key] != null)) {
                //value is array 
                columns.push({
                    field: key,
                    title: key,
                    align: "center",
                    formatter: function (value) {
                        return value.toString();
                    }
                })
            } else if (typeof this.#dataSet[0][key] === 'object' && this.#dataSet[0][key] != null) {
                //value is JSON object 

                columns.push({
                    field: key,
                    title: key,
                    align: "center",
                    formatter: function (value) {
                        return JSON.stringify(value)
                    }
                })
            } else {
                //common value
                columns.push({
                    field: key,
                    title: key,
                    align: "center"
                })
            }
        }
        $(this.#tableId).bootstrapTable('destroy');
        $(this.#tableId).bootstrapTable({
            data: this.#dataSet,
            customToolbarButtons: [
                {
                    name: "grid-export",
                    title: "Export",
                    icon: "glyphicon-export",
                    callback: this.exportToCSV
                },
                {
                    name: "grid-import",
                    title: "Import",
                    icon: "glyphicon-import",
                    callback: this.importFromCSV
                }
            ],
            editable: true,
            clickToSelect: true,
            cache: false,
            showToggle: false,
            pagination: true,
            pageList: [5],
            pageSize: 7,
            pageNumber: 1,
            uniqueId: 'id',
            striped: true,
            search: true,
            showRefresh: true,
            minimumCountColumns: 2,
            smartDisplay: true,
            columns: columns,
            sortName: 'displayId',
            sortOrder: 'desc'
        });
    }


    exportToCSV = () => {
        const separatorForColumns = ',';
        const headers = Object.keys(this.#dataSet[0]).join(separatorForColumns);
        const rows = this.#dataSet.map(row =>
            Object.values(row)
                .map(value => {
                    if (value === null || value === undefined) {
                        value = "";
                    } else {
                        //because array or json value includes comma
                        //hard to parse the values from csv (for import workflow)
                        //so set the value='Complicated Object' to csv.
                        if (typeof value === 'object') {
                            value = '<Complicated Object>';
                        } else if (Array.isArray(value)) {
                            value = '<Complicated Object>';
                        } else {
                            value = value.toString();
                        }
                    }
                    return `"${String(value).replace(/"/g, '""')}"`
                }) // Escape quotes
                .join(separatorForColumns)
        ).join('\n');

        const csvContent = `${headers}\n${rows}`;
        // Create a Blob and trigger download
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = this.#tabKey + (new Date()).getTime() + '.csv';
        link.click();
    }

    formatDate(date, format = 'YYYY-MM-DD') {
        const pad = (num) => String(num).padStart(2, '0');

        const replacements = {
            YYYY: date.getFullYear(),
            MM: pad(date.getMonth() + 1),
            DD: pad(date.getDate())
        };

        return format.replace(/YYYY|MM|DD/g, (match) => replacements[match]);
    }

    importFromCSV = async () => {
        if (TABLE_TABS[this.#tabKey].TAB_NAME != 'ISSUES') {
            alert('only issue is supported to be created/modified!Please activate ISSUES table first!');
            return;
        }
        let input = document.createElement('input');
        input.type = 'file';
        input.onchange = _ => {
            let fileUpload = Array.from(input.files);
            var regex = /^([a-zA-Z0-9\s_\\.\-:\(\)])+(.csv|.txt)$/;
            if (regex.test(fileUpload[0].name.toLowerCase())) {
                if (typeof (FileReader) != "undefined") {
                    var reader = new FileReader();
                    reader.onload = async (e) => {
                        function sleep(ms = 0) {
                            return new Promise(resolve => setTimeout(resolve, ms));
                        }
                        $("#loadingoverlay").fadeIn()
                        const rows = e.target.result.replace(/\r\n/g, '\n').split('\n'); // First replace \r\n with \n, then split by \n
<<<<<<< HEAD

=======
>>>>>>> 55bc61a363712489dd46193de6c36a28c7250e60
                        const keys = rows[0].split(',');
                        const import_attributes_keys = TABLE_TABS[this.#tabKey].IMPORT_ATTRIBUTES_KEYS;
                        let requestDataList = [];

                        for(let i=1;i<rows.length-1;i++){
                            // Split each row by commas to get each cell
                            const cells = rows[i].split(',');
                            let jsonItem = {};
                            for (let k = 0; k < cells.length; k++) {
                                let value = cells[k].replace(/^"(.*)"$/, '$1')
                                //only import those fields that are supported with create/modify
                                if (import_attributes_keys.includes(keys[k]) && value != null && value != undefined) {

                                    value = value.toString();
                                    //some special fields
                                    switch (keys[k]) {
                                        case 'dueDate':
                                            value = this.formatDate(new Date(value));
                                            break;
                                        case 'published':
                                            value = value.toLowerCase() === "true";
                                            break;
                                    }

                                    jsonItem[keys[k]] = value;
                                }
                            }
                            //record the csv row number for tracking error when
                            //creating/modifying issues.
                            jsonItem.csvRowNum = i;

                            requestDataList.push(jsonItem);
                        }


                        const data = {
                            'accountId': this.#accountId, //this.#accountId,
                            'projectId': this.#projectId, //this.#projectId,
                            'data': requestDataList
                        }

                        const url = TABLE_TABS[this.#tabKey].REQUEST_URL;
                        try {
                            const resp = await axios.post(url, data, {
                                headers: {
                                    'Content-Type': 'application/json'
                                }
                            });
                            resp.data.created && resp.data.created.forEach(item => console.log(`The row ${item.csvRowNum} is created with issue id ${item.id} `));
                            resp.data.modified && resp.data.modified.forEach(item => console.log(`The row ${item.csvRowNum} is modified with issue id ${item.id} `));
                            resp.data.failed && resp.data.failed.forEach(item => console.log(`The row ${item.csvRowNum} failed to be created/modified for the reason: ${item.reason} `));
                            await sleep(3000);
                            await this.resetData();
                        } catch (err) {
                            console.error(err);
                        }
                        this.drawTable();
                        $("#loadingoverlay").fadeOut()
                    }
                    reader.readAsText(fileUpload[0]);
                } else {
                    alert("This browser does not support HTML5.");
                }
            } else {
                alert("Please upload a valid CSV file.");
            }
        };
        input.click();
    }
}

export async function refreshTable(accountId = null, projectId = null) {
    $("#loadingoverlay").fadeIn()

    const activeTab = $("ul#issueTableTabs li.active")[0].id;
    try {
        await g_accDataTable.resetData(activeTab, accountId, projectId);
        g_accDataTable.drawTable();
    } catch (err) {
        console.warn(err);
    }
    $("#loadingoverlay").fadeOut()
}

export async function initTableTabs() {
    // add all tabs
    for (let key in TABLE_TABS) {
        $('<li id=' + key + '><a href="accTable" data-toggle="tab">' + TABLE_TABS[key].TAB_NAME + '</a></li>').appendTo('#issueTableTabs');
    }
    $("#ISSUES").addClass("active");
    // event on the tabs
    $('a[data-toggle="tab"]').on('shown.bs.tab', async function (e) {
        $("#loadingoverlay").fadeIn()
        const activeTab = e.target.parentElement.id;
        try {
            await g_accDataTable.resetData(activeTab);
            g_accDataTable.drawTable();
        } catch (err) {
            console.warn(err);
        }
        $("#loadingoverlay").fadeOut()
    });
}

var g_accDataTable = new Table('#accTable');
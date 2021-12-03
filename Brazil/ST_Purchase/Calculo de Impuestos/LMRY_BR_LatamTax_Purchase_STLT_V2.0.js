/* = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = =\
||   This script for customer center (Time)                     ||
||                                                              ||
||  File Name: LMRY_BR_LatamTax_Purchase_STLT_V2.0.js           ||
||                                                              ||
||  Version Date         Author        Remarks                  ||
||  2.0     Feb 05 2020  LatamReady    Bundle 37714             ||
 \= = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = */
/**
 * @NApiVersion 2.0
 * @NScriptType Suitelet
 * @NModuleScope Public
 */

define(['N/search', 'N/runtime', 'N/redirect', 'N/ui/serverWidget', 'N/log', 'N/record', 'N/url', 'N/task', './Latam_Library/LMRY_libSendingEmailsLBRY_V2.0'],
    function (search, runtime, redirect, serverWidget, log, record, url, task, LibraryMail) {

        var LMRY_script = 'LatamReady - BR LatamTax Purchase STLT';

        var allLicenses = {};
        var licenses = [];
        var subsidiaries = [];
        var anysubsidiary = false;

        function onRequest(scriptContext) {
            try {

                var subsi_OW = runtime.isFeatureInEffect({ feature: "SUBSIDIARIES" });
                var state = false;

                var Language = runtime.getCurrentScript().getParameter({ name: 'LANGUAGE' });
                Language = Language.substring(0, 2);

                switch (Language) {
                    case 'es':
                        //Mensajes de alerta
                        var LblForm = 'LatamTax Compras';
                        var LblMsg1 = 'AVISO: Actualmente la licencia para este módulo está vencida, por favor contacte al equipo comercial de LatamReady';
                        var LblMsg2 = 'También puedes contactar con nosotros a través de';
                        var LblMsg3 = 'Importane: El acceso no está permitido';
                        var Alert = 'Importante: Este proceso tardará en función de la cantidad de bills';
                        var LblGroup = 'Información Primaria';
                        var LblTittleMsg = 'Mensaje';
                        var LblState = 'Estado';
                        var LblText = 'Texto';
                        var LblResult = 'Resultados';
                        var LblSub = 'Subsidiaria';
                        var LblCur = 'Moneda';
                        var LblPeriod = 'Periodo';
                        var LblTrans = 'Transacción';
                        var LblApply = 'Aplicar';
                        var LblInternalID = 'ID Interno';
                        var LblEmail = 'Correo';
                        var LblDate = 'Fecha';
                        var LblExRate = 'Tipo de Cambio';
                        var LblPreview = 'Avance';
                        var BtnFilter = 'Filtrar';
                        var BtnBack = 'Atrás';
                        var BtnSave = 'Guardar';
                        var HTMLClick = 'Presionar Aquí';
                        var LblType = 'Tipo';
                        break;

                    case 'pt':
                        //Mensajes de alerta
                        var LblForm = 'LatamTax Compras';
                        var LblMsg1 = 'AVISO: Atualmente a licença para este módulo expirou, entre em contato com a equipe comercial da LatamReady';
                        var LblMsg2 = 'Você também pode nos contatar através de';
                        var LblMsg3 = 'Importante: o acesso não é permitido';
                        var Alert = 'Importante: Este processo demorará dependendo do número de notas a serem trocadas';
                        var LblGroup = 'Informação Primária';
                        var LblTittleMsg = 'Message';
                        var LblState = 'Mensagem';
                        var LblText = 'Texto';
                        var LblResult = 'Resultados';
                        var LblSub = 'Subsidiária';
                        var LblCur = 'Moeda';
                        var LblPeriod = 'Período';
                        var LblTrans = 'Transação';
                        var LblApply = 'Aplicar';
                        var LblInternalID = 'ID Interno';
                        var LblEmail = 'E-mail';
                        var LblDate = 'Data';
                        var LblExRate = 'Taxa de câmbio';
                        var LblPreview = 'Antevisão';
                        var BtnFilter = 'Filtro';
                        var BtnBack = 'Voltar';
                        var BtnSave = 'Salve';
                        var HTMLClick = 'Clique aqui';
                        var LblType = 'Tipo';
                        break;

                    default:
                        //Mensajes de alerta
                        var LblForm = 'LatamTax Purchase';
                        var LblMsg1 = 'NOTICE: Currently the license for this module is expired, please contact the commercial team of LatamReady';
                        var LblMsg2 = 'You can also contact us through';
                        var LblMsg3 = 'Important: Access is not allowed';
                        var Alert = 'Important: This process will take depending on the number of bills to be exchanged';
                        var LblGroup = 'Primary Information';
                        var LblTittleMsg = 'Message';
                        var LblState = 'Status';
                        var LblText = 'Text';
                        var LblResult = 'Results';
                        var LblSub = 'Subsidiary';
                        var LblCur = 'Currency';
                        var LblPeriod = 'Period';
                        var LblTrans = 'Transaction';
                        var LblApply = 'Apply';
                        var LblInternalID = 'Internal ID';
                        var LblEmail = 'Email';
                        var LblDate = 'Date';
                        var LblExRate = 'Exchange Rate';
                        var LblPreview = 'Preview';
                        var BtnFilter = 'Filter';
                        var BtnBack = 'Back';
                        var BtnSave = 'Save';
                        var HTMLClick = 'Click Here';
                        var LblType = 'Type';
                }

                if (scriptContext.request.method == 'GET') {

                    var Rd_SubId = scriptContext.request.parameters.custparam_subsi;
                    var Rd_CurrenId = scriptContext.request.parameters.custparam_currency;
                    var Rd_PerId = scriptContext.request.parameters.custparam_period;
                    ///var Rd_Concat = scriptContext.request.parameters.custparam_concat;

                    var subsi_OW = runtime.isFeatureInEffect({ feature: "SUBSIDIARIES" });

                    allLicenses = LibraryMail.getAllLicenses();
                    subsidiaries = getSubsidiaries();

                    for (var i = 0; i < subsidiaries.length; i++) {
                        if (allLicenses[subsidiaries[i].value] != null && allLicenses[subsidiaries[i].value] != '') {
                            licenses = allLicenses[subsidiaries[i].value];
                        } else {
                            licenses = [];
                        }
                        var enableFeature = LibraryMail.getAuthorization(527, licenses) || LibraryMail.getAuthorization(670, licenses);
                        if (enableFeature == true) {
                            subsidiaries[i].active = true;
                            anysubsidiary = true;
                        }
                    }


                    if (!anysubsidiary) {
                        var form = serverWidget.createForm({ title: LblForm });

                        // Mensaje para el cliente
                        var myInlineHtml = form.addField({
                            id: 'custpage_lmry_v_message',
                            label: LblTittleMsg,
                            type: serverWidget.FieldType.INLINEHTML
                        });

                        myInlineHtml.layoutType = serverWidget.FieldLayoutType.OUTSIDEBELOW;
                        myInlineHtml.updateBreakType({
                            breakType: serverWidget.FieldBreakType.STARTCOL
                        });

                        var strhtml = "<html>";
                        strhtml += "<table border='0' class='table_fields' cellspacing='0' cellpadding='0'>" +
                            "<tr>" +
                            "</tr>" +
                            "<tr>" +
                            "<td class='text'>" +
                            "<div style=\"color: gray; font-size: 12pt; margin-top: 10px; padding: 5px; border-top: 1pt solid silver\">" +
                            LblMsg1 + '. </br>' + LblMsg2 + 'www.Latamready.com' +
                            "</div>" +
                            "</td>" +
                            "</tr>" +
                            "</table>" +
                            "</html>";
                        myInlineHtml.defaultValue = strhtml;

                        // Dibuja el formularios
                        scriptContext.response.writePage(form);

                        // Termina el SuiteLet
                        return true;
                    }

                    //Formulario
                    var form = serverWidget.createForm({ title: LblForm });
                    form.addFieldGroup({
                        id: 'group_pi',
                        label: LblGroup
                    });

                    if (subsi_OW) {
                        var p_subsi = form.addField({
                            id: 'custpage_id_subsi',
                            label: LblSub,
                            type: serverWidget.FieldType.SELECT,
                            container: 'group_pi'
                        });
                        // Llena una linea vacia
                        p_subsi.addSelectOption({
                            value: 0,
                            text: ' '
                        });
                        // Llenado de listbox
                        for (var i = 0; i < subsidiaries.length; i++) {
                            if (subsidiaries[i].active) {
                                var subID = subsidiaries[i].value;
                                var subNM = subsidiaries[i].text;
                                p_subsi.addSelectOption({
                                    value: subID,
                                    text: subNM
                                });
                            }
                        }
                        p_subsi.isMandatory = true;
                    }

                    // Seteo en el rellamado
                    if (Rd_SubId != '' && Rd_SubId != null) {
                        p_subsi.defaultValue = Rd_SubId;
                        p_subsi.updateDisplayType({
                            displayType: serverWidget.FieldDisplayType.DISABLED
                        });
                    }

                    var p_currency = form.addField({
                        id: 'custpage_id_currency',
                        label: LblCur,
                        type: serverWidget.FieldType.SELECT,
                        source: 'currency',
                        container: 'group_pi'
                    });
                    p_currency.isMandatory = true;
                    // Seteo en el rellamado
                    if (Rd_CurrenId != '' && Rd_CurrenId != null) {
                        p_currency.defaultValue = Rd_CurrenId;
                        p_currency.updateDisplayType({
                            displayType: serverWidget.FieldDisplayType.DISABLED
                        });
                    }

                    var p_period = form.addField({
                        id: 'custpage_id_period',
                        label: LblPeriod,
                        type: serverWidget.FieldType.SELECT,
                        container: 'group_pi'
                    });
                    p_period.isMandatory = true;
                    // Seteo en el rellamado
                    if (Rd_PerId != '' && Rd_PerId != null) {
                        p_period.defaultValue = Rd_PerId;
                        p_period.updateDisplayType({
                            displayType: serverWidget.FieldDisplayType.DISABLED
                        });
                    }

                    var field_accounting_period = p_period;
                    field_accounting_period.addSelectOption({
                        value: 0,
                        text: ' '
                    });

                    var search_period = search.create({
                        type: 'accountingperiod',
                        filters: [['isadjust', 'is', 'F'], 'AND', ['isquarter', 'is', 'F'], 'AND', ['isinactive', 'is', 'F'], "AND", ['isyear', 'is', 'F']],
                        columns:
                            [
                                search.createColumn({ name: "internalid", summary: "GROUP", sort: search.Sort.DESC, label: "Internal ID" }),
                                search.createColumn({ name: "periodname", summary: "GROUP", label: "Name" })
                            ]
                    });
                    var resul_period = search_period.run();
                    var lengt_period = resul_period.getRange({
                        start: 0,
                        end: 1000
                    });

                    if (lengt_period != null) {
                        for (var i = 0; i < lengt_period.length; i++) {
                            var varcolu = lengt_period[i].columns;
                            var valores = lengt_period[i].getValue(varcolu[0]);
                            var textos = lengt_period[i].getValue(varcolu[1]);
                            field_accounting_period.addSelectOption({
                                value: valores,
                                text: textos
                            });
                        }
                    }



                    var p_state = form.addField({
                        id: 'custpage_id_state',
                        label: LblState,
                        type: serverWidget.FieldType.TEXT,
                        container: 'group_pi'
                    });
                    p_state.defaultValue = 'F';
                    p_state.updateDisplayType({
                        displayType: serverWidget.FieldDisplayType.HIDDEN
                    });


                    if (Rd_SubId != '' && Rd_SubId != null) {
                        p_state.defaultValue = 'T';
                        state = true;
                    }


                    var p_texto = form.addField({
                        id: 'custpage_id_texto',
                        label: LblText,
                        type: serverWidget.FieldType.INLINEHTML,
                    });
                    var strhtml = "<html>";
                    strhtml += "<table border='0' class='table_fields' cellspacing='0' cellpadding='0'>" +
                        "<tr>" +
                        "</tr>" +
                        "<tr>" +
                        "<td class='text'>" +
                        "<div style=\"color: gray; font-size: 8pt; margin-top: 10px; padding: 5px; border-top: 1pt solid silver\">" +
                        Alert +
                        "</div>" +
                        "</td>" +
                        "</tr>" +
                        "</table>" +
                        "</html>";

                    p_texto.defaultValue = strhtml;

                    //Creación del Log
                    var SubTabla = form.addSublist({
                        id: 'custpage_id_sublista',
                        type: serverWidget.SublistType.LIST,
                        label: LblResult
                    });

                    SubTabla.addMarkAllButtons();

                    SubTabla.addField({ id: 'id_appl', label: LblApply, type: serverWidget.FieldType.CHECKBOX });
                    SubTabla.addField({ id: 'id_int', label: LblInternalID, type: serverWidget.FieldType.TEXT });
                    SubTabla.addField({ id: 'id_type', label: LblType, type: serverWidget.FieldType.TEXT });
                    SubTabla.addField({ id: 'id_tran', label: LblTrans, type: serverWidget.FieldType.TEXT });
                    SubTabla.addField({ id: 'id_date', label: LblDate, type: serverWidget.FieldType.DATE });
                    SubTabla.addField({ id: 'id_curn', label: LblCur, type: serverWidget.FieldType.TEXT });
                    SubTabla.addField({ id: 'id_exch', label: LblExRate, type: serverWidget.FieldType.TEXT });
                    SubTabla.addField({ id: 'id_pre', label: LblPreview, type: serverWidget.FieldType.TEXT });

                    if ((Rd_SubId != null && Rd_SubId != '') &&
                        (Rd_PerId != null && Rd_PerId != '') &&
                        (Rd_CurrenId != null && Rd_CurrenId != '')) {

                        var filtros = [];
                        var auxfiltro = [];
                        var filterTypes = ["PurchOrd"];
                        if (LibraryMail.getAuthorization(629, allLicenses[Rd_SubId])) {
                            filterTypes.push("ItemShip");
                        }
                        if (!LibraryMail.getAuthorization(608, allLicenses[Rd_SubId])) {
                            filterTypes.push("VendCred");
                        }
                        auxfiltro.push([["type", "anyof", ["VendBill", "CardChrg", "CardRfnd"]], 'AND', ["voided", "is", "F"]], 'OR');
                        auxfiltro.push(["type", "anyof", filterTypes]);

                        filtros.push(['mainline', 'is', ['T']], 'AND');
                        filtros.push(auxfiltro, 'AND');
                        filtros.push(['subsidiary', 'anyof', [Rd_SubId]], 'AND');
                        filtros.push(['currency', 'anyof', [Rd_CurrenId]], 'AND');
                        filtros.push(['postingperiod', 'anyof', [Rd_PerId]], 'AND');
                        filtros.push(['custbody_lmry_scheduled_process', 'is', ['F']], 'AND');

                        //Transacciones de retencion: 18-09-2021
                        filtros.push(['memo', 'doesnotcontain', 'latam'], 'AND');
                        //Bills de multa e interes: 27-10.2021
                        filtros.push(['custbody_lmry_reference_transaction', 'anyof', '@NONE@'], 'AND');
                        //

                        filtros.push(["formulatext: CASE WHEN (UPPER({type.id})=UPPER('VendBill') or UPPER({type.id})=UPPER('CardChrg') or UPPER({type.id})=UPPER('CardRfnd')) and {custbody_lmry_subsidiary_country.id}=30 and {custrecord_lmry_br_related_transaction.custrecord_lmry_br_block_taxes.id}= 1 THEN 1 ELSE 0 END", "is", "0"]);

                        log.debug('filtros', JSON.stringify(filtros));

                        var invoiceSearchObj = search.create({
                            type: "transaction",
                            filters: filtros,
                            columns: ["internalid", "tranid", "transactionnumber", "trandate",
                                "currency", "exchangerate", "type"]
                        });

                        invoiceSearchObj = invoiceSearchObj.run();

                        //var invoiceSearchResult = invoiceSearchObj.getRange(0, 1000);

                        var bandera = true;
                        var contador = 0;
                        var c = 0;
                        var invoiceSearchResult = [];

                        while (bandera) {

                            invoiceSearchResult = invoiceSearchObj.getRange({ start: contador, end: contador + 900 });

                            if (invoiceSearchResult != '' && invoiceSearchResult != null) {
                                for (var i = 0; i < invoiceSearchResult.length; i++) {

                                    var internalId = '' + invoiceSearchResult[i].getValue({
                                        name: 'internalid'
                                    });
                                    var tranId = '' + invoiceSearchResult[i].getValue({
                                        name: 'tranid'
                                    });
                                    var type = '' + invoiceSearchResult[i].getValue({
                                        name: 'type'
                                    });
                                    var transactionNumber = '' + invoiceSearchResult[i].getValue({
                                        name: 'transactionnumber'
                                    });
                                    var tranDate = invoiceSearchResult[i].getValue({
                                        name: 'trandate'
                                    });
                                    var currency = invoiceSearchResult[i].getText({
                                        name: 'currency'
                                    });
                                    var exchangeRate = invoiceSearchResult[i].getValue({
                                        name: 'exchangerate'
                                    });

                                    var typeTran = '';
                                    if (type != '') {
                                        SubTabla.setSublistValue({
                                            id: 'id_type',
                                            line: c,
                                            value: type
                                        });

                                        switch (type) {
                                            case 'VendBill':
                                                typeTran = 'vendorbill';
                                                break;
                                            case 'VendCred':
                                                typeTran = 'vendorcredit';
                                                break;
                                            case 'PurchOrd':
                                                typeTran = 'purchaseorder';
                                                break;
                                            case 'ItemShip':
                                                typeTran = 'itemfulfillment';
                                                break;
                                            case 'CardChrg':
                                                typeTran = 'creditcardcharge';
                                                break;
                                            case 'CardRfnd':
                                                typeTran = 'creditcardrefund';
                                                break;
                                        }
                                    }
                                    if (internalId != '') {
                                        var url_detalle = url.resolveRecord({
                                            recordType: typeTran,
                                            recordId: parseInt(internalId)
                                        });
                                        SubTabla.setSublistValue({
                                            id: 'id_int',
                                            line: c,
                                            value: '<a href="' + url_detalle + '" target="_blank">' + internalId + '</a>'
                                        });

                                        var urlRedi = url.resolveScript({
                                            scriptId: 'customscript_lmry_br_latamtax_pre_stlt',
                                            deploymentId: 'customdeploy_lmry_br_latamtax_pre_stlt',
                                            returnExternalUrl: false
                                        });
                                        urlRedi += '&internalid=' + internalId + '&typetran=' + typeTran;
                                        SubTabla.setSublistValue({
                                            id: 'id_pre',
                                            line: c,
                                            value: '<a href="' + urlRedi + '" target="_blank">' + HTMLClick + '</a>'
                                        });
                                    }

                                    if (tranId != '') {
                                        SubTabla.setSublistValue({
                                            id: 'id_tran',
                                            line: c,
                                            value: tranId
                                        });
                                    } else {
                                        if (transactionNumber != '') {
                                            SubTabla.setSublistValue({
                                                id: 'id_tran',
                                                line: c,
                                                value: transactionNumber
                                            });
                                        }
                                    }
                                    if (tranDate != '') {
                                        SubTabla.setSublistValue({
                                            id: 'id_date',
                                            line: c,
                                            value: tranDate
                                        });
                                    }
                                    if (currency != '') {
                                        SubTabla.setSublistValue({
                                            id: 'id_curn',
                                            line: c,
                                            value: currency
                                        });
                                    }
                                    if (exchangeRate != '') {
                                        SubTabla.setSublistValue({
                                            id: 'id_exch',
                                            line: c,
                                            value: exchangeRate
                                        });
                                    }
                                    c++;
                                }
                            }

                            if (invoiceSearchResult.length == 900) {
                                contador = contador + 900;
                            } else {
                                bandera = false;
                            }

                        } // END While

                    }

                    if (state == false) {
                        form.addSubmitButton({
                            label: BtnFilter
                        });
                    } else {

                        form.addSubmitButton({
                            label: BtnSave
                        });

                        form.addButton({
                            id: 'buttonid',
                            label: BtnBack,
                            functionName: 'redirectBack()'
                        });
                    }


                    /*form.addResetButton({
                        label: BtnReset
                    });*/

                    // Script Cliente
                    form.clientScriptModulePath = './Latam_Library/LMRY_BR_LatamTax_Purchase_CLNT_V2.0.js';

                    scriptContext.response.writePage(form);
                } else {

                    if (scriptContext.request.parameters.custpage_id_state == 'F') {
                        var params = {};
                        if (subsi_OW) {
                            params['custparam_subsi'] = scriptContext.request.parameters.custpage_id_subsi;
                        }
                        params['custparam_period'] = scriptContext.request.parameters.custpage_id_period;
                        params['custparam_currency'] = scriptContext.request.parameters.custpage_id_currency;

                        // realiza la consulta con los parametros seleccionados
                        redirect.toSuitelet({
                            scriptId: runtime.getCurrentScript().id,
                            deploymentId: runtime.getCurrentScript().deploymentId,
                            parameters: params
                        });
                    } else {
                        var c_invoices = scriptContext.request.getLineCount({
                            group: 'custpage_id_sublista'
                        });
                        var transactions = [];

                        var subsidiary = 1;
                        if (subsi_OW) {
                            subsidiary = scriptContext.request.parameters.custpage_id_subsi;
                        }
                        var period = scriptContext.request.parameters.custpage_id_period;
                        var currency = scriptContext.request.parameters.custpage_id_currency;

                        for (var i = 0; i < c_invoices; i++) {
                            var aplica = scriptContext.request.getSublistValue({
                                group: 'custpage_id_sublista',
                                name: 'id_appl',
                                line: i
                            });
                            if (aplica == 'T' || aplica == true) {
                                var id_inv = scriptContext.request.getSublistValue({
                                    group: 'custpage_id_sublista',
                                    name: 'id_int',
                                    line: i
                                });
                                id_inv = id_inv.split('>')[1];
                                id_inv = id_inv.split('<')[0];
                                transactions.push(id_inv);
                            }
                        }
                        log.debug('transactions', transactions.join('|'));

                        var usuario = runtime.getCurrentUser().id;

                        var r_log = record.create({ type: 'customrecord_lmry_br_latamtax_pur_log' });

                        r_log.setValue({ fieldId: 'custrecord_lmry_br_pur_log_user', value: usuario });
                        r_log.setValue({ fieldId: 'custrecord_lmry_br_pur_log_transactions', value: transactions.join('|') });
                        r_log.setValue({ fieldId: 'custrecord_lmry_br_pur_log_subsidiary', value: subsidiary });
                        r_log.setValue({ fieldId: 'custrecord_lmry_br_pur_log_currency', value: currency });
                        r_log.setValue({ fieldId: 'custrecord_lmry_br_pur_log_period', value: period });
                        r_log.setValue({ fieldId: 'custrecord_lmry_br_pur_log_execute_type', value: 'Manual' });
                        r_log.setValue({ fieldId: 'custrecord_lmry_br_pur_log_status', value: '4' });

                        var id_return = r_log.save();

                        var scheduledScript = task.create({
                            taskType: task.TaskType.MAP_REDUCE,
                            scriptId: 'customscript_lmry_br_latamtax_pur_mprd',
                            deploymentId: 'customdeploy_lmry_br_latamtax_pur_mprd',
                            params: {
                                'custscript_lmry_br_latamtax_pur_mprd': id_return
                            }
                        });
                        scheduledScript.submit();

                        redirect.toSuitelet({
                            scriptId: 'customscript_lmry_br_latamtax_log_stlt',
                            deploymentId: 'customdeploy_lmry_br_latamtax_log_stlt'
                        });
                    }

                }

            } catch (err) {
                var form = serverWidget.createForm({ title: LblForm });
                var myInlineHtml = form.addField({ id: 'custpage_id_message', label: LblTittleMsg, type: serverWidget.FieldType.INLINEHTML });
                myInlineHtml.layoutType = serverWidget.FieldLayoutType.OUTSIDEBELOW;
                myInlineHtml.updateBreakType({ breakType: serverWidget.FieldBreakType.STARTCOL });

                var strhtml = "<html>";
                strhtml += "<table border='0' class='table_fields' cellspacing='0' cellpadding='0'>" +
                    "<tr>" +
                    "</tr>" +
                    "<tr>" +
                    "<td class='text'>" +
                    "<div style=\"color: gray; font-size: 12pt; margin-top: 10px; padding: 5px; border-top: 1pt solid silver\">" + LblMsg3 + "</div>" +
                    "</td>" +
                    "</tr>" +
                    "</table>" +
                    "</html>";

                myInlineHtml.defaultValue = strhtml;

                // Dibuja el Formulario
                scriptContext.response.writePage(form);
                log.error(LMRY_script + ' [onRequest]', err);
            }
            return true;
        }

        function getSubsidiaries() {
            var subsis = [];

            var search_Subs = search.create({
                type: search.Type.SUBSIDIARY,
                filters: [
                    ['isinactive', 'is', 'F'], 'AND',
                    ['country', 'is', 'BR']
                ],
                columns: ['internalid', 'name']
            });
            var lengt_sub = search_Subs.run().getRange(0, 1000);

            if (lengt_sub != null && lengt_sub.length > 0) {
                // Llenado de listbox
                for (var i = 0; i < lengt_sub.length; i++) {
                    var subID = lengt_sub[i].getValue('internalid');
                    var subNM = lengt_sub[i].getValue('name');
                    subsis.push({
                        value: subID,
                        text: subNM,
                        active: false
                    });
                }
            }
            return subsis;
        }

        return {
            onRequest: onRequest
        };

    });

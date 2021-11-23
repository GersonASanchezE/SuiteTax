/* = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = =\
||   This script for customer center (Time)                     ||
||                                                              ||
||  File Name: LMRY_CusTransferIvaLBRY_V2.0.js                 	||
||                                                              ||
||  Version Date         Author        Remarks                  ||
||  2.0     Jul 23 2018  LatamReady    Use Script 2.0           ||
 \= = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = */
 /**
  * @NApiVersion 2.x
  * @NModuleScope Public
  */
define(['N/record', 'N/runtime', 'N/search', 'N/config', 'N/log', 'N/format', './LMRY_libSendingEmailsLBRY_V2.0'],

function(record, runtime, search, config, log, format, library) {


	var LMRY_script = 'Ventas - Traslado de IVA V2.0';
	var scriptObj = runtime.getCurrentScript();
	/* ------------------------------------------------------------------------------------------------------
	 * Realiza el traslado de IVA
	 * --------------------------------------------------------------------------------------------------- */
	function CPTransferIVA(idnewcobranza) {

		try {
			//Trae parametros de Preferencias Generales
			var paramcuentaiva1 = scriptObj.getParameter({name:'custscript_lmry_param_cta_iva_vtas_debe'});
			var paramcuentaiva2 = scriptObj.getParameter({name:'custscript_lmry_param_cta_iva_vtas_haber'});

			// Carga transaccion de cobranza
			var custPaymentRec = record.load({type:'customerpayment', id:idnewcobranza});

			/*** Verifica que la cuenta no se encuentre en la lista de exclusion. ***/
			var aracct = custPaymentRec.getValue({fieldId:'account'});

			// Valida que el campo no este vacio
			if ( aracct!='' && aracct!=null)
			{
				// Filtros de la transaccion
				var filters = new Array();
				filters[0] = search.createFilter({
						name: 'custrecord_lmry_account_no_transferiva',
						operator: search.Operator.ANYOF,
						values: aracct
				});
				filters[1] = search.createFilter({
						name: 'isinactive',
						operator: search.Operator.IS,
						values: 'F'
				});

				var noaccountObj = search.create({
						type: 'customrecord_lmry_account_no_transferiva',
						columns: ['internalid'],
						filters: filters
				});
				var noaccount = noaccountObj.run().getRange(0,1000);
				if ( noaccount!=null && noaccount!='') {

					// Marca la transaccion como excluida del proceso
					var id = record.submitFields({
					    type: 'customerpayment',
					    id: idnewcobranza,
					    values: {
					        'custbody_lmry_schedule_transfer_of_iva': '3'
					    }
					});

					// Load the record
					log.error('CPTransferIVA: Transaccion y Account [No se procesa]' , idnewcobranza + ',' + aracct);
					return true;
				}
			}

			// Inicia el proceso de Traslado de IVA
			var period = custPaymentRec.getValue({fieldId:'postingperiod'});
			var datecob = custPaymentRec.getValue({fieldId:'trandate'});
			var currencycob = custPaymentRec.getValue({fieldId:'currency'});
			var subsidiary = custPaymentRec.getValue({fieldId:'subsidiary'});

			var montoivacalc = 0;
			var exchangerate = 1;
			var tranidtext = '';

			// Moneda de la subsidiaria
			var subcurrency = 0;
			var featuresubs = runtime.isFeatureInEffect({feature: "SUBSIDIARIES"});
			if (featuresubs == true || featuresubs == 'T'){
				var searchCurrency = search.lookupFields({
						type: 'subsidiary',
						id: subsidiary,
						columns: ['currency']
				});
				subcurrency = searchCurrency.currency[0].value;
			} else {
				// Load the NetSuite Company Preferences page
				var company = config.load({
				    type: config.Type.COMPANY_INFORMATION
				});
					// set field values
				subcurrency = company.getValue({fieldId:'basecurrency'});
				company = null;
			}

			// Trae lista de documentos cobrados
			var applySublitsCount = custPaymentRec.getLineCount({sublistId:'apply'});
			log.error('applySublitsCount-->' , applySublitsCount);
			for (var i = 0; i < applySublitsCount; i++)
			{
				var apply =custPaymentRec.getSublistValue({sublistId:'apply', fieldId:'apply', line:i});
				var swiva = false;
				// Aplicado en el pago
				if (apply == 'T')
				{
					// Get the 'doc' field on the line item on the Apply sublist. This is the internal of the record.
					var recID = custPaymentRec.getSublistValue({sublistId:'apply', fieldId:'doc', line:i});
					// Get the type of the line item
					var lineItemType = custPaymentRec.getSublistValue({sublistId:'apply', fieldId:'type', line:i});
					// Trae monto cobrado
					var paymentAmount = custPaymentRec.getSublistValue({sublistId:'apply', fieldId:'amount', line:i});
					// Load the record
					log.error('CPTransferIVA: payID - Type - recID' , idnewcobranza + ' - ' + lineItemType + ' - ' + recID);

					// No procesa el Asiento Diario
					if ( lineItemType != 'Journal' && lineItemType != 'Diario' ){
						var invoiceRecord = record.load({type:'invoice', id:recID});
						// Subsidiary, Departament, Class, Location
						var detasubs = invoiceRecord.getValue({fieldId:'subsidiary'});
						var detadepa = invoiceRecord.getValue({fieldId:'department'});
						var detaclas = invoiceRecord.getValue({fieldId:'class'});
						var detaloca = invoiceRecord.getValue({fieldId:'location'});
						// Entidad
						var entityid = invoiceRecord.getValue({fieldId:'entity'});
						var taxtotal = invoiceRecord.getValue({fieldId:'taxtotal'});
						var totalamount = invoiceRecord.getValue({fieldId:'total'});
						var tranid 	= invoiceRecord.getValue({fieldId:'tranid'});
						// Tipo de Cambio de la transaccion
						exchangerate= invoiceRecord.getValue({fieldId:'exchangerate'});
						// Base Imponible
						var montosiniva = parseFloat(totalamount) - parseFloat(taxtotal);
						var porciva = parseFloat(taxtotal) / parseFloat(montosiniva);
							porciva = parseFloat(1) + parseFloat(porciva);
						var basepayment = parseFloat(paymentAmount) / parseFloat(porciva);

						montoivacalc = parseFloat(paymentAmount) - parseFloat(basepayment);
						montoivacalc = montoivacalc.toFixed(2);
						// Convierte a moneda base
						if ( parseFloat(exchangerate)!=0 ) {
							montoivacalc  = parseFloat(montoivacalc) * parseFloat(exchangerate);
							montoivacalc = montoivacalc.toFixed(2);
						}

						tranidtext   = 'Traslado IVA Ventas-Doc: '+tranid;

						// Creacion de Asiento Diario si IVA calculado es diferente a cero
						if ( parseFloat(montoivacalc)!=0 )
						{
							var jeRec = record.create({type:'journalentry'});
								// Formulario Personalizado
								Field_Formsdf = scriptObj.getParameter({name:'custscript_lmry_wht_journal_entry'});
								if ( Field_Formsdf!='' && Field_Formsdf!=null) {
									jeRec.setValue({fieldId:'customform' , value:Field_Formsdf});
								}
								// Subsidiary, Departament, Class, Location
								jeRec.setValue({fieldId:'subsidiary', value:detasubs});
								jeRec.setValue({fieldId:'department', value:detadepa});
								jeRec.setValue({fieldId:'class',	  value:detaclas});
								jeRec.setValue({fieldId:'location',   value:detaloca});
								// Asocia cobranza a asiento diario
								jeRec.setValue({fieldId:'trandate',	  value:datecob});
								jeRec.setValue({fieldId:'postingperiod', value:period});
								jeRec.setValue({fieldId:'currency', value:subcurrency});
								jeRec.setValue({fieldId:'exchangerate', value:1});

								// Campos Latam Ready
								jeRec.setValue({fieldId:'custbody_lmry_apply_transaction', value:idnewcobranza});
								jeRec.setValue({fieldId:'custbody_lmry_reference_entity',     value:entityid});
								jeRec.setValue({fieldId:'custbody_lmry_reference_transaction', value:recID});
								jeRec.setValue({fieldId:'custbody_lmry_reference_transaction_id', value:recID });

								//Linea de debito
								jeRec.selectNewLine({sublistId:'line'});
								jeRec.setCurrentSublistValue({sublistId:'line', fieldId:'account', value:paramcuentaiva1});
								jeRec.setCurrentSublistValue({sublistId:'line', fieldId:'debit', value:format.format({value:montoivacalc, type: format.Type.CURRENCY})});
								jeRec.setCurrentSublistValue({sublistId:'line', fieldId:'entity', value:entityid});
								jeRec.setCurrentSublistValue({sublistId:'line', fieldId:'memo', value:tranidtext});
								// Departament, Class, Location
								jeRec.setCurrentSublistValue({sublistId:'line', fieldId:'department', value:detadepa});
								jeRec.setCurrentSublistValue({sublistId:'line', fieldId:'class',	    value:detaclas});
								jeRec.setCurrentSublistValue({sublistId:'line', fieldId:'location',   value:detaloca});
								jeRec.commitLine({sublistId:'line'});

								//Linea de credito
								jeRec.selectNewLine({sublistId:'line'});
								jeRec.setCurrentSublistValue({sublistId:'line', fieldId:'account', value:paramcuentaiva2});
								jeRec.setCurrentSublistValue({sublistId:'line', fieldId:'credit', value:format.format({value:montoivacalc, type: format.Type.CURRENCY})});
								jeRec.setCurrentSublistValue({sublistId:'line', fieldId:'entity', value:entityid});
								jeRec.setCurrentSublistValue({sublistId:'line', fieldId:'memo', value:tranidtext});
								// Departament, Class, Location
								jeRec.setCurrentSublistValue({sublistId:'line', fieldId:'department', value:detadepa});
								jeRec.setCurrentSublistValue({sublistId:'line', fieldId:'class',	    value:detaclas});
								jeRec.setCurrentSublistValue({sublistId:'line', fieldId:'location',   value:detaloca});
								jeRec.commitLine({sublistId:'line'});

							jeRec.save();

							// Actualiza la factura de Cliente
							var submit = record.submitFields({
									type: 'invoice',
									id: recID,
									values: {
											'custbody_lmry_schedule_transfer_of_iva': '1'
									}
							});
						}
				  }	// No procesa el Asiento Diario
				}
			}

			log.error('customerpayment' ,  'Pago procesado');

			// Marca la transaccion como procesada
			var submit = record.submitFields({
					type: 'customerpayment',
					id: idnewcobranza,
					values: {
							'custbody_lmry_schedule_transfer_of_iva': '1'
					}
			});
			// Devuelve valor verdadero

			return true;

		}catch(error) {
			log.error('error : ' , error);
			library.sendemail(' [ CPTransferIVA ] ' +error, 'LMRY_libTransferTaxLBRY');

			// Devuelve valor falso
			return false;
		}

	}

	/* ------------------------------------------------------------------------------------------------------
	 * Elimina los Journal Entry creados
	 * --------------------------------------------------------------------------------------------------- */
	function CPDeleteJE(ID) {
		try {
			// Valida que no esta vacio el ID
			if ( ID=='' || ID==null ) {
				return true;
			}

			/* Se realiza una busqueda para ver que campos se ocultan */
			// Filtros
			var filters = new Array();
			filters[0] = search.createFilter({
					name: 'mainline',
					operator: search.Operator.IS,
					values: 'T'
			});
			filters[1] = search.createFilter({
					name: 'custbody_lmry_apply_transaction',
					operator: search.Operator.IS,
					values: ID
			});

			// Realiza un busqueda para mostrar los campos
			var searchjournalObj = search.create({
					type: 'journalentry',
					columns: ['internalid'],
					filters: filters
			});
			var searchjournal = searchjournalObj.run().getRange(0,1000);
			if ( searchjournal!=null && searchjournal!='' ){
				if ( searchjournal.length==0 ) {
					return true;
				}
				// Auxiliar ID
				var aux = 0;
				for(var i=0; i<searchjournal.length; i++){
					var columns = searchjournal[i].columns;
					var idjournal = searchjournal[i].getValue(columns[0]);
					if (idjournal!=aux){
						aux = idjournal;
						record.delete({type:'journalentry', id:idjournal});

						log.error('CPDeleteJE - ID' , idjournal);
					}
				}
			}
		}catch(error) {
			library.sendemail(' [ CPDeleteJE ] ' +error, 'LMRY_libTransferTaxLBRY');
		}
	}

	/* ------------------------------------------------------------------------------------------------------
	 * Realiza el traslado de IVA - Compras
	 * --------------------------------------------------------------------------------------------------- */
	function ERTransferIVA(idnewpagoprov) {
		try {
			var montoivacalc = 0;
			var montoivatot = 0;
			var tranidtext = '';
			var contador = 0;

			var paramcuentaiva1 = scriptObj.getParameter({name:'custscript_lmry_param_cta_iva_cpras_debe'});
			var paramcuentaiva2 = scriptObj.getParameter({name:'custscript_lmry_param_cta_iva_cpras_habe'});
			var customform 		= scriptObj.getParameter({name:'custscript_lmry_wht_journal_entry'});

			if((paramcuentaiva1!='' && paramcuentaiva1!=null) &&
				(paramcuentaiva2!='' && paramcuentaiva2!=null) &&
				(customform!='' && customform!=null)  ){
				// Carga transaccion de pago a proveedor
				var expensereportRecord = record.load({type:'expensereport', id:idnewpagoprov});
				// Subsidiary
				var detasubs 	= expensereportRecord.getValue({fieldId:'subsidiary'});
				// Empleado
				var employee 	= expensereportRecord.getValue({fieldId:'entity'});
				// Periodo y Fecha
				var period 		= expensereportRecord.getValue({fieldId:'postingperiod'});
				var datecob 	= expensereportRecord.getValue({fieldId:'trandate'});

				//Creacion de Asiento Diario
				var jeRec = record.create({type:'journalentry', isDynamic:true});
					// Formulario personalizado
					jeRec.setValue({fieldId:'customform', value:customform});
					// Subsidiary, Departament, Class, Location
					jeRec.setValue({fieldId:'subsidiary', value:detasubs});
					// Asocia pago a proveedor a asiento diario
					jeRec.setValue({fieldId:'trandate',		value:datecob});
					jeRec.setValue({fieldId:'postingperiod',value:period});
					// Campos Latam Ready
					jeRec.setValue({fieldId:'custbody_lmry_reference_employee' , value:employee});
					jeRec.setValue({fieldId:'custbody_lmry_reference_transaction' , value:idnewpagoprov});
					jeRec.setValue({fieldId:'custbody_lmry_reference_transaction_id', value:idnewpagoprov });

				// Lista de Expense Report
				var applySublitsCount = expensereportRecord.getLineCount({sublistId:'expense'});
				for (var i = 0; i < applySublitsCount; i++)
				{
					// Departament, Class, Location
					var detadepa = expensereportRecord.getSublistValue({sublistId:'expense', fieldId:'department', line:i});
					var detaclas = expensereportRecord.getSublistValue({sublistId:'expense', fieldId:'class', line:i});
					var detaloca = expensereportRecord.getSublistValue({sublistId:'expense', fieldId:'location', line:i});
					// Trae monto cobrado
					var entityid = expensereportRecord.getSublistValue({sublistId:'expense', fieldId:'custcol_lmry_exp_rep_vendor_colum', line:i});
					var tranid 	 = expensereportRecord.getSublistValue({sublistId:'expense', fieldId:'custcol_lmry_exp_rep_num_doc', line:i});
					if ( tranid==null ) {
						tranid = '';
					}
					var montoivacalc= expensereportRecord.getSublistValue({sublistId:'expense', fieldId:'tax1amt', line:i});
					tranidtext = 'Latam Traslado IVA Informe Gastos: ' + tranid;
					log.error('entityid',entityid);
					log.error('montoivacalc',montoivacalc);
					// El monto tiene que ser mayor a cero
					if ( montoivacalc > 0 ) {
						// Linea de debito
						jeRec.selectNewLine({sublistId:'line'});
						jeRec.setCurrentSublistValue({sublistId:'line', fieldId:'account', value:paramcuentaiva1});
						jeRec.setCurrentSublistValue({sublistId:'line', fieldId:'debit', 	 value:montoivacalc});
						jeRec.setCurrentSublistValue({sublistId:'line', fieldId:'memo', 	 value:tranidtext});
						// Departament, Class, Location
						if(detadepa!=null && detadepa!=''){
							jeRec.setCurrentSublistValue({sublistId:'line', fieldId:'department', value:detadepa});
						}
						if(detaclas!=null && detaclas!=''){
							jeRec.setCurrentSublistValue({sublistId:'line', fieldId:'class',	    value:detaclas});
						}
						if(detaloca!=null && detaloca!=''){
							jeRec.setCurrentSublistValue({sublistId:'line', fieldId:'location',   value:detaloca});
						}
						// Graba la linea
						jeRec.commitLine({sublistId:'line'});

						// Linea de credito
						jeRec.selectNewLine({sublistId:'line'});
						jeRec.setCurrentSublistValue({sublistId:'line', fieldId:'account', value:paramcuentaiva2});
						jeRec.setCurrentSublistValue({sublistId:'line', fieldId:'credit',  value:montoivacalc});
						jeRec.setCurrentSublistValue({sublistId:'line', fieldId:'memo', 	 value:tranidtext});
						// Departament, Class, Location
						if(detadepa!=null && detadepa!=''){
							jeRec.setCurrentSublistValue({sublistId:'line', fieldId:'department', value:detadepa});
						}
						if(detaclas!=null && detaclas!=''){
							jeRec.setCurrentSublistValue({sublistId:'line', fieldId:'class',	    value:detaclas});
						}
						if(detaloca!=null && detaloca!=''){
							jeRec.setCurrentSublistValue({sublistId:'line', fieldId:'location',   value:detaloca});
						}
						// Graba la linea
						jeRec.commitLine({sublistId:'line'});

						contador = contador + 2;
					}
				}
				// Graba el Journal
				var JECount = jeRec.getLineCount({sublistId:'line'});
				log.error('JECount',JECount);
				if ( JECount > 0) {
					// Graba el registro
					var newrec = jeRec.save({
						enableSourcing: true,
						ignoreMandatoryFields: true
					});
					log.error('ERTransferIVA - New ID' , newrec);
				}

				montoivatot += montoivacalc;

				//montoivatot = montoivatot.toFixed(2);
			}

		}catch(error) {
			library.sendemail(' [ ERTransferIVA ] ' +error, 'LMRY_libTransferTaxLBRY');
		}
	}

	/* ------------------------------------------------------------------------------------------------------
	 * Elimina los Journal Entry creados
	 * --------------------------------------------------------------------------------------------------- */
	function ERDeleteJE(ID) {
		try {
			// Valida que no esta vacio el ID
			if ( ID=='' || ID==null ) {
				return true;
			}

			log.error('ID', ID);

			/* Se realiza una busqueda para ver que campos se ocultan */
			// Filtros
			var filters = new Array();
			filters[0] = search.createFilter({
					name: 'mainline',
					operator: search.Operator.IS,
					values: 'T'
			});
			filters[1] = search.createFilter({
					name: 'custbody_lmry_reference_transaction',
					operator: search.Operator.IS,
					values: ID
			});

			// Realiza un busqueda para mostrar los campos
			var searchjournalObj = search.create({
					type: 'journalentry',
					columns: ['internalid'],
					filters: filters
			});
			var searchjournal = searchjournalObj.run().getRange(0,1000);
			log.error('searchjournal', searchjournal);
			if ( searchjournal!=null && searchjournal!='' ){
				log.error('searchjournal.length', searchjournal.length);
				if ( searchjournal.length==0 ) {
					return true;
				}
				// Auxiliar ID
				var aux = 0;
				for(var i=0; i<searchjournal.length; i++){
					var columns = searchjournal[i].columns;
					var idjournal = searchjournal[i].getValue(columns[0]);
					if (idjournal!=aux){
						aux = idjournal;
						record.delete({type:'journalentry', id:idjournal});

						log.error('CPDeleteJE - ID' , idjournal);
					}
				}
			}
		}catch(error) {
			library.sendemail(' [ ERDeleteJE ] ' +error, 'LMRY_libCusTransIvaLBRY');
		}
	}


	/* ------------------------------------------------------------------------------------------------------
	 * Crea nuevos asistentos por el pago anualdo
	 * --------------------------------------------------------------------------------------------------- */
	function CreateJournalEntry(RecordID) {
		try {
			log.error('CreateJournalEntry ', RecordID );

			if ( RecordID=='' || RecordID==null) {
				return 0;
			}
			/* Se realiza una busqueda para ver que campos se ocultan */
			// Filtros
			var filters = new Array();
			filters[0] = search.createFilter({
					name: 'mainline',
					operator: search.Operator.IS,
					values: 'T'
			});
			filters[1] = search.createFilter({
					name: 'custbody_lmry_apply_transaction',
					operator: search.Operator.ANYOF,
					values: RecordID
			});

			// Realiza un busqueda para mostrar los campos
			var searchjournalObj = search.create({
					type: 'journalentry',
					columns: ['internalid'],
					filters: filters
			});
			var searchjournal = searchjournalObj.run().getRange(0,1000);
			if ( searchjournal!=null && searchjournal!='' ){
				// Auxiliar ID
				var aux = 0;
				for(var i=0; i<searchjournal.length; i++){
					var columns = searchjournal[i].columns;
					var idjournal = searchjournal[i].getValue(columns[0]);
					// Valida que el ID no se haya ya procesado
					if (idjournal!=aux){
						// Crea el copia del registro
						aux = idjournal;
						var newJE = record.copy({
						    type: 'journalentry',
						    id: idjournal
						});
						var JECount = newJE.getLineount({sublistId:'line'});
						for (var i = 0; i < JECount; i++)
						{
							var debit  = newJE.setSublistValue({sublistId:'line', fieldId:'debit', line:i});
							var credit = newJE.setSublistValue({sublistId:'line', fieldId:'credit', line:i});
							var memos  = 'Void Of ' + newJE.setSublistValue({sublistId:'line', fieldId:'memo', line:i});
							// Debito para al credito
							if ( debit!='' && debit!=null && debit!=0 )
							{
								newJE.setSublistValue({sublistId:'line', fieldId:'credit', line:i, value:debit});
							}
							// Credito para el Debito
							if ( credit!='' && credit!=null && credit!=0 )
							{
								newJE.setSublistValue({sublistId:'line', fieldId:'debit', line:i, value:credit});
							}
							newJE.setSublistValue({sublistId:'line', fieldId:'memo', line:i, value:memos});
						}
						// Graba el registro
						var newID = newJE.save();
						//SE ELIMINA EL ASIENTO GENERADO INICIALMENTE
						CPDeleteJE(RecordID);
						//ESTO FUE MODIFICADO 08/02/2015
						log.error('CreateJournalEntry - New ID' , newID);
					}
				}
			}
		}catch(error) {
			library.sendemail(' [ CreateJournalEntry ] ' +error, 'LMRY_libTransferTaxLBRY');
		}
	}
	return{
			CPTransferIVA: CPTransferIVA,
			CPDeleteJE: CPDeleteJE,
			ERTransferIVA: ERTransferIVA,
			ERDeleteJE: ERDeleteJE,
			CreateJournalEntry: CreateJournalEntry
	};
});

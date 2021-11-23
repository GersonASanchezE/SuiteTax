/**
 * Module Description
 *
 * Version    Date            Author           Remarks
 * 1.00       28 Apr 2016     LatamReady
 * File : LMRY_MX-GL-LinesPlug-in.js
 */
var objContext =  nlapiGetContext();
var LMRY_script= 'LatamReady - MX GL Lines Plug-in';
var strCountry = '';
var lmryTypeTransaction = '';
var lmrySubsidiaryId = '';
var fechaTransaction = new Date();
var featuresubs = '';
var ArrTaxCode = new Array();
var subsidiary = '';
var entityID = '';

function customizeGlImpact(transactionRecord, standardLines, customLines, book){
	try {
		//Obteniendo valor del tipo de transaccion
		lmryTypeTransaction	= transactionRecord.getRecordType();
		lmryTypeTransaction = lmryTypeTransaction.toLocaleUpperCase();
		fechaTransaction = transactionRecord.getFieldValue("trandate");
		entityID = transactionRecord.getFieldValue("entity");

		// Solo aplica para Invoice y Credit Memo
		nlapiLogExecution('EMERGENCY', 'lmryTypeTransaction' , lmryTypeTransaction + ' , ' + transactionRecord.getFieldValue('tranid'));
		if (lmryTypeTransaction!='INVOICE' && lmryTypeTransaction!='CREDITMEMO' && lmryTypeTransaction!='ITEMFULFILLMENT') { return true; }

		featuresubs = nlapiGetContext().getFeature('SUBSIDIARIES');
		if (featuresubs == 'T' || featuresubs==true) { lmrySubsidiaryId = transactionRecord.getFieldValue('subsidiary'); }

		// Solo para Mexico
		if (lmrySubsidiaryId != '' && lmrySubsidiaryId != null) { strCountry = nlapiLookupField('subsidiary', lmrySubsidiaryId, 'country'); }

		// Obtener el campo personalizado
		/*var namefield = '';

		// Busqueda - Filtros
		var filters = null;
		if (featuresubs == 'T' || featuresubs==true){
			filters = new Array();
			filters[0] = new nlobjSearchFilter( 'custrecord_lmry_mx_gl_subsidiary', null, 'anyof', lmrySubsidiaryId);
		}
		// Busqueda - Campos
		var columns = new Array();
			columns[0] = new nlobjSearchColumn('custrecord_lmry_mx_gl_field');
		// Ejecutas la busqueda
		var hidefields = nlapiSearchRecord( 'customrecord_lmry_mx_gl_lines_plug_in', null, filters , columns );
		if (hidefields!=null && hidefields!='') {
			if (hidefields.length>0) {
				namefield = hidefields[0].getValue('custrecord_lmry_mx_gl_field');
			}
		}

		// Solo para Subsidiaria Mexico y que el campo personaliado este definido
		nlapiLogExecution('EMERGENCY', 'strCountry , namefield' , strCountry + ' , ' + namefield);*/

		if ( (strCountry=='MX' || strCountry=='mx')/* && (namefield!='' && namefield!=null) */)
		{
			if(lmryTypeTransaction=='ITEMFULFILLMENT'){
				// Carga los Impuestos a un Arreglo
				Obtiene_TaxCode_Setup();
				// Agrega la lineas al GL
				Suite_GL_Mexico(transactionRecord, standardLines, customLines, book);
			} else{
				// Si es refacturacion no ingresa al proceso
				/*var _EsReFacturable = transactionRecord.getFieldValue(namefield);
				nlapiLogExecution('EMERGENCY', '_EsReFacturable' , _EsReFacturable);
				if (_EsReFacturable=='F' || _EsReFacturable=='f' || _EsReFacturable==false)
				{*/
					// Carga los Impuestos a un Arreglo
					Obtiene_TaxCode_Setup();
					// Agrega la lineas al GL
					Suite_GL_Mexico(transactionRecord, standardLines, customLines, book);
				//}
			}

		}
	}catch(err){
		mx_gl_send_email(' [ customizeGlImpact ] ' +err, LMRY_script);
		nlapiLogExecution('ERROR', 'ERROR' , err);
	}
}

/********************************************************************
 * Funcion Obtiene_TaxCode_Setup, carga los codigo de impuesto
 *******************************************************************/
function Obtiene_TaxCode_Setup() {
	try {
		// Control de Memoria
		var intDMaxReg = 1000;
		var intDMinReg = 0;
		var arrAuxiliar = new Array();

		var DbolStop = false;
		var _cont = 0;

		// Consulta de Cuentas
		var savedsearch = nlapiLoadSearch('customrecord_lmry_taxcode_setup', 'customsearch_lmry_mx_taxcode_setup');
		var searchresult = savedsearch.runSearch();
		while (!DbolStop) {
			var objResult = searchresult.getResults(intDMinReg, intDMaxReg);
			if (objResult != null)
			{
				// Cantidad de Codigo de Impuesto
				var intLength = objResult.length;
				//nlapiLogExecution('EMERGENCY', 'Obtiene_TaxCode_Setup' , objResult.length);
				for(var i = 0; i < intLength; i++) {
					columns = objResult[i].getAllColumns();
					arrAuxiliar = new Array();

					//0. PAIS
					if (objResult[i].getText(columns[0])!=null) {
						arrAuxiliar[0] = objResult[i].getText(columns[0]);
					} else {
						arrAuxiliar[0] = '';
					}

					//1. TAX CODE
					if (objResult[i].getValue(columns[1])!=null) {
						arrAuxiliar[1] = objResult[i].getValue(columns[1]);
						arrAuxiliar[2] = objResult[i].getText(columns[1]);
					} else {
						arrAuxiliar[1] = '';
						arrAuxiliar[2] = '';
					}

					//2. CLASSIFICATION
					if (objResult[i].getValue(columns[2])!=null) {
						arrAuxiliar[3] = objResult[i].getValue(columns[2]);
					} else {
						arrAuxiliar[3] = '';
					}

					//3. TAX RATE
					if (objResult[i].getValue(columns[3])!=null){
						arrAuxiliar[4] = objResult[i].getValue(columns[3]);
					} else {
						arrAuxiliar[4] = '';
					}

					// Carga arreglo
					ArrTaxCode[_cont] = arrAuxiliar;
					_cont++;
				 }
				// Siguientes 1000 registros
				 intDMinReg = intDMaxReg;
				 intDMaxReg += 1000;
				 if (intLength<1000) { DbolStop = true; }
			} else {
				DbolStop = true;
			}
		}
	}catch(err){
		//mx_gl_send_email(' [ Obtiene_TaxCode_Setup ] ' +err, LMRY_script);
		nlapiLogExecution('ERROR', 'ERROR' , err);
		throw ' [ Obtiene_TaxCode_Setup ] ' + err;
	}
}

/********************************************************************
 * Funcion Suite_GL_Mexico, realiza el redirecionamiento de cuentas
 *******************************************************************/
function Suite_GL_Mexico(transactionRecord, standardLines, customLines, book)
{
	try {
		// Cliente, Fecha y Fecha de Vencimiento
		var IdCustomerRecord = transactionRecord.getFieldValue('entity');
		var TranDateRecord 	 = transactionRecord.getFieldValue('trandate');
		if (lmryTypeTransaction!='ITEMFULFILLMENT'){
			var DueDateRecord 	 = transactionRecord.getFieldValue('duedate');
		}
		// Departamento, Clase y Ubicacion
		var Departamento	= standardLines.getLine(1).getDepartmentId();
		var Clase 			= standardLines.getLine(1).getClassId();
		var Location 		= standardLines.getLine(1).getLocationId();

		switch(lmryTypeTransaction){
			case 'INVOICE': lmryTypeTransaction = 7;break;
			case 'CREDITMEMO': lmryTypeTransaction = 10;break;
			case 'ITEMFULFILLMENT': lmryTypeTransaction = 32;break;
			default: lmryTypeTransaction = 0;break;
		}

		//Obtiene Latam Relacionada
		var columnFrom = nlapiLookupField('customer', IdCustomerRecord,[ 'custentity_lmry_entityrelated','custentity_lmry_foreign']);
		var EsRelacionada =columnFrom.custentity_lmry_entityrelated;
		var EsExtranjero = columnFrom.custentity_lmry_foreign;

		var arrayCuentasGL = new Array();
		for (var countGL = 0; countGL < standardLines.getCount(); countGL++) {
			if(standardLines.getLine(countGL).getAccountId()){
				arrayCuentasGL.push(standardLines.getLine(countGL).getAccountId());
			}
		}

		if(arrayCuentasGL.length == 0){
			return true;
		}

		// Registro personalizado de Cuentas a redireccionar
		var savedSearchAccountMapping = nlapiLoadSearch('customrecord_lmry_redirection_accounts', 'customsearch_lmry_redirection_accounts');
			savedSearchAccountMapping.addFilter(new nlobjSearchFilter('custrecord_lmry_redirectionacc_transacc', null, 'anyof', arrayCuentasGL));
			savedSearchAccountMapping.addFilter(new nlobjSearchFilter('custrecord_lmry_redirectionacc_tran_type', null, 'is', lmryTypeTransaction));
		var objResultSet	= savedSearchAccountMapping.runSearch();
		var searchresult 	= objResultSet.getResults(0, 1000);

		// Validando lineas de GL Estandard de NetSuite
		//nlapiLogExecution('EMERGENCY', 'Suite_GL_Mexico - standardLines' , standardLines.getCount());
		//nlapiLogExecution('EMERGENCY', 'Suite_GL_Mexico - searchresult' , searchresult.length);
		for (var countGLNew = 0; countGLNew < standardLines.getCount(); countGLNew++) {
			var cuentaOrigenStandard = standardLines.getLine(countGLNew).getAccountId();
			var montoCreditoStandard = standardLines.getLine(countGLNew).getCreditAmount();
			var montoDebitoStandard  = standardLines.getLine(countGLNew).getDebitAmount();
			var entityStandard  = standardLines.getLine(countGLNew).getEntityId();
			//nlapiLogExecution('EMERGENCY', 'LineDatos'+countGLNew , cuentaOrigenStandard+','+montoCreditoStandard+','+montoDebitoStandard+','+entityStandard);
			if(montoCreditoStandard<=0 && montoDebitoStandard<=0){
				continue;
			}
			//nlapiLogExecution('EMERGENCY', 'cuentaOrigenStandard'+countGLNew , cuentaOrigenStandard);
			// Obtiene las lineas de la transaccion
			var TaxCodeStandard  = standardLines.getLine(countGLNew).getTaxItemId();
      nlapiLogExecution('EMERGENCY', 'TaxCodeStandard', TaxCodeStandard);
      nlapiLogExecution('EMERGENCY', 'ArrTaxCode', ArrTaxCode);
			//nlapiLogExecution('EMERGENCY', 'TaxCodeStandard' , TaxCodeStandard);
			for(var cuentaNew=0; cuentaNew<searchresult.length; cuentaNew++)
			{
				var columnsNew = searchresult[cuentaNew].getAllColumns();
				var AccouMappingOrigen = searchresult[cuentaNew].getValue(columnsNew[2]);
				var criterioAccMapping = searchresult[cuentaNew].getValue(columnsNew[5]);

				var recaccfr = '';
				var recaccto = '';
				// Busca la cuenta Standard en el Custom Record

				nlapiLogExecution('EMERGENCY', 'AccouMappingOrigen' , AccouMappingOrigen+','+cuentaOrigenStandard);
				if(cuentaOrigenStandard == AccouMappingOrigen)
				{
					//nlapiLogExecution('EMERGENCY', 'Suite_GL_Mexico - cuentaOrigenStandard, criterioAccMapping' , cuentaOrigenStandard + ' , ' + criterioAccMapping);

					// Busca los codigo de impuestos
					var TaxRate  = 0;
					var TaxClase = '';
					var TaxCode  = '';
					for(var x=0; x<=ArrTaxCode.length-1; x++)
					{
						if (TaxCodeStandard==ArrTaxCode[x][1])
						{
							TaxCode  = ArrTaxCode[x][2];
							TaxClase = ArrTaxCode[x][3];
							TaxRate  = parseFloat(ArrTaxCode[x][4]);
						}
					}
					//nlapiLogExecution('EMERGENCY', 'Datos' , criterioAccMapping + ' , ' + TaxClase);

					// Invoice Transacction
					if (lmryTypeTransaction==7)
					{
						// 1 - 401.02 Ventas y/o servicios gravados a la tasa general de contado
						if (criterioAccMapping==1 && TaxClase==1 && (nlapiStringToDate(DueDateRecord,'date')-nlapiStringToDate(TranDateRecord,'date'))<=0 &&
							(EsRelacionada=='F' || EsRelacionada=='f') && (EsExtranjero=='F' || EsExtranjero =='f'))
						{
							recaccfr = searchresult[cuentaNew].getValue(columnsNew[3]);
							recaccto = searchresult[cuentaNew].getValue(columnsNew[4]);
						}
						// 2 - 401.03 Ventas y/o servicios gravados a la tasa general a credito
						if (criterioAccMapping==2 && TaxClase==1 && (nlapiStringToDate(DueDateRecord,'date')-nlapiStringToDate(TranDateRecord,'date'))>0 &&
							(EsRelacionada=='F' || EsRelacionada=='f') && (EsExtranjero=='F' || EsExtranjero =='f'))
						{
							recaccfr = searchresult[cuentaNew].getValue(columnsNew[3]);
							recaccto = searchresult[cuentaNew].getValue(columnsNew[4]);
						}
						// 3 - 401.05 Ventas y/o servicios gravados al 0% de contado
						if (criterioAccMapping==3 && TaxClase==2 && (nlapiStringToDate(DueDateRecord,'date')-nlapiStringToDate(TranDateRecord,'date'))<=0 &&
						   (EsRelacionada=='F' || EsRelacionada=='f') && (EsExtranjero=='F' || EsExtranjero =='f'))
						{
							recaccfr = searchresult[cuentaNew].getValue(columnsNew[3]);
							recaccto = searchresult[cuentaNew].getValue(columnsNew[4]);
						}
						// 4 - 401.06 Ventas y/o servicios gravados al 0% a credito
						if (criterioAccMapping==4 && TaxClase==2 && (nlapiStringToDate(DueDateRecord,'date')-nlapiStringToDate(TranDateRecord,'date'))>0 &&
						   (EsRelacionada=='F' || EsRelacionada=='f') && (EsExtranjero=='F' || EsExtranjero =='f'))
						{
							recaccfr = searchresult[cuentaNew].getValue(columnsNew[3]);
							recaccto = searchresult[cuentaNew].getValue(columnsNew[4]);
						}
						// 5 - 401.08 Ventas y/o servicios exentos de contado
						if (criterioAccMapping==5 && TaxClase == 3 &&
						   (nlapiStringToDate(DueDateRecord,'date')-nlapiStringToDate(TranDateRecord,'date'))<=0 &&
						   (EsRelacionada=='F' || EsRelacionada=='f') && (EsExtranjero=='F' || EsExtranjero =='f'))
						{
							recaccfr = searchresult[cuentaNew].getValue(columnsNew[3]);
							recaccto = searchresult[cuentaNew].getValue(columnsNew[4]);
						}
						// 6 - 401.09 Ventas y/o servicios exentos a credito
						if (criterioAccMapping==6 && (TaxClase==3 && TaxRate==0 ) &&
						   (nlapiStringToDate(DueDateRecord,'date')-nlapiStringToDate(TranDateRecord,'date'))>0 &&
						   (EsRelacionada=='F' || EsRelacionada=='f') && (EsExtranjero=='F' || EsExtranjero =='f'))
						{
							recaccfr = searchresult[cuentaNew].getValue(columnsNew[3]);
							recaccto = searchresult[cuentaNew].getValue(columnsNew[4]);
						}
						// 7 - 401.10 Ventas y/o servicios gravados a la tasa general nacionales partes relacionadas
						if (criterioAccMapping==7 && TaxRate>0 &&  (EsRelacionada=='T' || EsRelacionada=='t' ) &&
							(EsExtranjero=='F' || EsExtranjero =='f'))
						{
							recaccfr = searchresult[cuentaNew].getValue(columnsNew[3]);
							recaccto = searchresult[cuentaNew].getValue(columnsNew[4]);
						}
						// 8 - 401.11 Ventas y/o servicios gravados a la tasa general extranjeros partes relacionadas
            nlapiLogExecution('EMERGENCY', 'criterioAccMapping', criterioAccMapping);
            nlapiLogExecution('EMERGENCY', 'TaxRate', TaxRate);
            nlapiLogExecution('EMERGENCY', 'EsRelacionada', EsRelacionada);
            nlapiLogExecution('EMERGENCY', 'EsExtranjero', EsExtranjero);
            if (criterioAccMapping==8 && TaxRate>0 &&  (EsRelacionada=='T' || EsRelacionada=='t' ) &&
						   (EsExtranjero=='T' || EsExtranjero =='t'))
						{
							recaccfr = searchresult[cuentaNew].getValue(columnsNew[3]);
							recaccto = searchresult[cuentaNew].getValue(columnsNew[4]);
						}
						// 9 - 401.12 Ventas y/o servicios gravados al 0% nacionales partes relacionadas
						if (criterioAccMapping==9 && (TaxRate==0 && TaxClase!=3) && (EsRelacionada=='T' || EsRelacionada=='t' ) &&
						   (EsExtranjero=='F' || EsExtranjero =='f') )
						{
							recaccfr = searchresult[cuentaNew].getValue(columnsNew[3]);
							recaccto = searchresult[cuentaNew].getValue(columnsNew[4]);
						}
						// 10 - 401.13 Ventas y/o servicios gravados al 0% extranjeros partes relacionadas
						if (criterioAccMapping==10 && (TaxRate==0 && TaxClase!=3) &&  (EsRelacionada=='T' || EsRelacionada=='t' ) &&
						   (EsExtranjero=='T' || EsExtranjero =='t') )
						{
							recaccfr = searchresult[cuentaNew].getValue(columnsNew[3]);
							recaccto = searchresult[cuentaNew].getValue(columnsNew[4]);
						}
						// 11 - 401.14 Ventas y/o servicios exentos nacionales partes relacionadas
						if (criterioAccMapping==11 && (TaxRate==0 && TaxClase==3  ) && (EsRelacionada=='T' || EsRelacionada=='t' ) &&
						   (EsExtranjero=='F' || EsExtranjero =='f' || EsExtranjero =='null') )
						{
							recaccfr = searchresult[cuentaNew].getValue(columnsNew[3]);
							recaccto = searchresult[cuentaNew].getValue(columnsNew[4]);
						}
						// 12 - 401.15 Ventas y/o servicios exentos extranjeros partes relacionadas
						if (criterioAccMapping==12 && (TaxRate==0 && TaxClase==3) && (EsRelacionada=='T' || EsRelacionada=='t' ) &&
						   (EsExtranjero=='T' || EsExtranjero =='t') )
						{
							recaccfr = searchresult[cuentaNew].getValue(columnsNew[3]);
							recaccto = searchresult[cuentaNew].getValue(columnsNew[4]);
						}
						// 13 - 401.25 Ingresos por exportaciï¿½n
						if (criterioAccMapping==13 && (EsRelacionada=='F' || EsRelacionada=='f' ) && (EsExtranjero=='T' || EsExtranjero =='t') )
						{
							recaccfr = searchresult[cuentaNew].getValue(columnsNew[3]);
							recaccto = searchresult[cuentaNew].getValue(columnsNew[4]);
						}
					}

					// Credit Memo Transacction
					if (lmryTypeTransaction==10)
					{
						// 14 - 402.01 Devoluciones, descuentos o bonificaciones sobre ventas y/o servicios a la tasa general
						if (criterioAccMapping==14 && TaxRate>0 )
						{
							recaccfr = searchresult[cuentaNew].getValue(columnsNew[3]);
							recaccto = searchresult[cuentaNew].getValue(columnsNew[4]);
						}
						// 15 - 402.02 Devoluciones, descuentos o bonificaciones sobre ventas y/o servicios al 0%
						if (criterioAccMapping==15 && (TaxRate==0 && TaxClase!=3) )
						{
							recaccfr = searchresult[cuentaNew].getValue(columnsNew[3]);
							recaccto = searchresult[cuentaNew].getValue(columnsNew[4]);
						}
						// 16 - 402.03 Devoluciones, descuentos o bonificaciones sobre ventas y/o servicios exentos
						if (criterioAccMapping==16 && (TaxRate==0 && TaxClase==3) )
						{
							recaccfr = searchresult[cuentaNew].getValue(columnsNew[3]);
							recaccto = searchresult[cuentaNew].getValue(columnsNew[4]);
						}
					}

					// Item Fulfillment Transacction
					if (lmryTypeTransaction==32)
					{
						// 17 - 504.01 Gastos indirectos de fabricación
						if (criterioAccMapping==17 && (EsRelacionada=='F' || EsRelacionada=='f'))
						{
							recaccfr = searchresult[cuentaNew].getValue(columnsNew[3]);
							recaccto = searchresult[cuentaNew].getValue(columnsNew[4]);
						}
						// 18 - 504.02 Gastos indirectos de fabricación de partes relacionadas nacionales
						if (criterioAccMapping==18 && (EsRelacionada=='T' || EsRelacionada=='t') && (EsExtranjero=='F' || EsExtranjero =='f'))
						{
							recaccfr = searchresult[cuentaNew].getValue(columnsNew[3]);
							recaccto = searchresult[cuentaNew].getValue(columnsNew[4]);
						}
						// 19 - 504.03 Gastos indirectos de fabricación de partes relacionadas extranjeras
						if (criterioAccMapping==19 && (EsRelacionada=='T' || EsRelacionada=='t') && (EsExtranjero=='T' || EsExtranjero =='t'))
						{
							recaccfr = searchresult[cuentaNew].getValue(columnsNew[3]);
							recaccto = searchresult[cuentaNew].getValue(columnsNew[4]);
						}
						// 20 - 504.04 Otras cuentas de costos incurridos
						if (criterioAccMapping==20 && (EsRelacionada=='F' || EsRelacionada=='f'))
						{
							recaccfr = searchresult[cuentaNew].getValue(columnsNew[3]);
							recaccto = searchresult[cuentaNew].getValue(columnsNew[4]);
						}
						// 21 - 504.05 Otras cuentas de costos incurridos con partes relacionadas nacionales
						if (criterioAccMapping==21 && (EsRelacionada=='T' || EsRelacionada=='t') && (EsExtranjero=='F' || EsExtranjero =='f'))
						{
							recaccfr = searchresult[cuentaNew].getValue(columnsNew[3]);
							recaccto = searchresult[cuentaNew].getValue(columnsNew[4]);
						}
						// 22 - 504.06 Otras cuentas de costos incurridos con partes relacionadas extranjeras
						if (criterioAccMapping==22 && (EsRelacionada=='T' || EsRelacionada=='t') && (EsExtranjero=='T' || EsExtranjero =='t'))
						{
							recaccfr = searchresult[cuentaNew].getValue(columnsNew[3]);
							recaccto = searchresult[cuentaNew].getValue(columnsNew[4]);
						}
					}

					// Importe traslado
					//nlapiLogExecution('EMERGENCY', 'Suite_GL_Mexico - recaccto, recaccfr' , recaccto + ' , ' + recaccfr);
					if (recaccto!='' && recaccfr!='')
					{
						nlapiLogExecution('ERROR', 'Montos,entityID' , montoDebitoStandard+','+montoCreditoStandard+','+entityID);
						recaccto = devolverCuenta(recaccto, book.getId());
						recaccfr = devolverCuenta(recaccfr, book.getId());
						//nlapiLogExecution('EMERGENCY', 'Suite_GL_Mexico - Departamento, Clase, Location' , Departamento + ' , ' + Clase  + ' , ' + Location);
						//Creacion de Linea de Cuentas
						var newLine1 = customLines.addNewLine();
							newLine1.setAccountId(parseFloat(recaccto));
							if (montoDebitoStandard!=0 )  { newLine1.setDebitAmount(montoDebitoStandard); }
							if (montoCreditoStandard!=0 ) { newLine1.setCreditAmount(montoCreditoStandard); }
							newLine1.setEntityId(parseInt(entityID));
							newLine1.setClassId(Clase);
							newLine1.setDepartmentId(Departamento);
							newLine1.setLocationId(Location);
							newLine1.setMemo("LatamReady - Reclasificacion automatica de ingresos via SuiteGL");

						var newLine2 = customLines.addNewLine();
							newLine2.setAccountId(parseFloat(recaccfr));
							if (montoCreditoStandard!=0 ) { newLine2.setDebitAmount(montoCreditoStandard); }
							if (montoDebitoStandard!=0 )  { newLine2.setCreditAmount(montoDebitoStandard); }
							newLine2.setEntityId(parseInt(entityID));
							newLine2.setClassId(Clase);
							newLine2.setDepartmentId(Departamento);
							newLine2.setLocationId(Location);
							newLine2.setMemo("LatamReady - Reclasificacion automatica de ingresos via SuiteGL");

						// Sale del For
						break;
					}	// Fin If
				}	// Busca la cuenta Standard en el Custom Record
			}	// FOR - Obtiene las lineas de la transaccion
			var remainingUsage = nlapiGetContext().getRemainingUsage();
			//nlapiLogExecution('EMERGENCY', 'remainingUsage' , remainingUsage);
		} // FOR - Validando lineas de GL Estandard de NetSuite
	}catch(err){
		//mx_gl_send_email(' [ Suite_GL_Mexico ] ' +err, LMRY_script);
		nlapiLogExecution('ERROR', 'ERROR' , err);
		throw ' [ Suite_GL_Mexico ] ' + err;
	}

	function devolverCuenta(cuentaSource, currentBook){

	  try{

	    var filtros_gam = new Array();
	    filtros_gam[0] = new nlobjSearchFilter('sourceaccount', null, 'anyof', cuentaSource);
	    filtros_gam[1] = new nlobjSearchFilter('accountingbook', null, 'anyof', currentBook);
	    filtros_gam[2] = new nlobjSearchFilter('effectivedate', null, 'onorbefore', fechaTransaction);
	    //filtros_gam[3] = new nlobjSearchFilter('enddate', null, 'onorafter', fechaTransaction);
	    if(featuresubs){
	      filtros_gam[3] = new nlobjSearchFilter('subsidiary', null, 'anyof', lmrySubsidiaryId);
	    }

	    var columnas_gam = new Array();
	    columnas_gam[0] = new nlobjSearchColumn("internalid");
	    columnas_gam[1] = new nlobjSearchColumn("destinationaccount");
			columnas_gam[2] = new nlobjSearchColumn('enddate');

	    var search_gam = nlapiCreateSearch('globalaccountmapping',filtros_gam,columnas_gam);
	    var result_gam = search_gam.runSearch().getResults(0,1000);

	    if(result_gam != null && result_gam.length > 0){
				for(var i=0;i<result_gam.length;i++){
					var fechafin = result_gam[i].getValue('enddate');
					if(fechafin=='' || fechafin==null){
						return result_gam[i].getValue('destinationaccount');
					} else{
						if(yyymmdd(fechaTransaction) <= yyymmdd(fechafin)){
							return result_gam[i].getValue('destinationaccount');
						} else{
							return cuentaSource;
						}
					}
				}
	      return result_gam[0].getValue('destinationaccount');
	    }else{
				var filtros_iam = new Array();
		    filtros_iam[0] = new nlobjSearchFilter('sourceaccount', null, 'anyof', cuentaSource);
		    filtros_iam[1] = new nlobjSearchFilter('accountingbook', null, 'anyof', currentBook);
		    filtros_iam[2] = new nlobjSearchFilter('effectivedate', null, 'onorbefore', fechaTransaction);
		    //filtros_iam[3] = new nlobjSearchFilter('enddate', null, 'onorafter', fechaTransaction);
		    if(featuresubs){
		      filtros_iam[3] = new nlobjSearchFilter('subsidiary', null, 'anyof', lmrySubsidiaryId);
		    }
				var columnas_iam = new Array();
		    columnas_iam[0] = new nlobjSearchColumn("internalid");
		    columnas_iam[1] = new nlobjSearchColumn("destinationaccount");
				columnas_iam[2] = new nlobjSearchColumn("enddate");

				var search_iam = nlapiCreateSearch('itemaccountmapping',filtros_iam,columnas_iam);
		    var result_iam = search_iam.runSearch().getResults(0,1);
				if(result_iam != null && result_iam.length > 0){
					for(var i=0;i<result_iam.length;i++){
						var fechafin = result_iam[i].getValue('enddate');
						if(fechafin=='' || fechafin==null){
							return result_iam[i].getValue('destinationaccount');
						} else{
							if(yyymmdd(fechaTransaction) <= yyymmdd(fechafin)){
								return result_iam[i].getValue('destinationaccount');
							} else{
								return cuentaSource;
							}
						}
					}
		    } else{
					return cuentaSource;
				}

	    }

	  }catch (err){
	    nlapiLogExecution('ERROR', 'devolverCuenta', err);
		//mx_gl_send_email(' [ devolverCuenta ] ' + err, LMRY_script);
		throw ' [ devolverCuenta ] ' + err;
	  }

	}
	function yyymmdd(dateString) {

		if (dateString == '' || dateString == null) {
			return '';
		}

		var date = new Date(dateString);

		var year = date.getFullYear();

		var month = "" + (date.getMonth() + 1);

		if (month.length < 2)
			month = "0" + month;

		var date = "" + date.getDate();
		if (date.length < 2)
			date = "0" + date;

		var fe = '' + year + "" + month + "" + date;

		return fe;
	}
}

      // Global variables
        let excelData = [];
        let filteredData = [];
        const resultsPerPage = 20;
        let currentPage = 1;
        let totalPages = 1;
        let seatChoices, branchChoices, collegeChoices;

        // Helper functions
        function showNotification(message, type = 'error') {
            const notification = document.getElementById('notification');
            notification.querySelector('span').textContent = message;
            notification.className = `notification ${type} show`;
            
            setTimeout(() => {
                notification.className = 'notification';
            }, 5000);
        }

        function getCollegeTypeFromInstitute(instituteName) {
            if (!instituteName) return "Other";
            
            const name = instituteName.toLowerCase();
            if (name.includes("government") && name.includes("autonomous")) return "Government-Autonomous";
            if (name.includes("government")) return "Government";
            if (name.includes("autonomous")) return "Autonomous";
            if (name.includes("aided")) return "Aided";
            if (name.includes("unaided")) return "Unaided";
            return "Other";
        }

        // Initialize Choices.js dropdowns
        function initDropdowns() {
            seatChoices = new Choices('#seatType', {
                removeItemButton: true,
                placeholder: true,
                placeholderValue: "Choose seat types",
                allowHTML: false,
                duplicateItemsAllowed: false,
                searchEnabled: true,
                searchPlaceholderValue: "Search seat types"
            });

            branchChoices = new Choices('#branch', {
                removeItemButton: true,
                placeholder: true,
                placeholderValue: "Choose branches",
                allowHTML: false,
                duplicateItemsAllowed: false,
                searchEnabled: true,
                searchPlaceholderValue: "Search branches"
            });

            collegeChoices = new Choices('#collegeType', {
                removeItemButton: true,
                placeholder: true,
                placeholderValue: "Choose college types",
                allowHTML: false,
                duplicateItemsAllowed: false,
                searchEnabled: true,
                searchPlaceholderValue: "Search college types"
            });
        }

        // Populate dropdowns from JSON data
        function populateDropdowns(data) {
            // Seat types
            const seatTypes = [...new Set(data.map(d => d["Seat Type"]))];
            seatChoices.setChoices(seatTypes.map(type => ({ value: type, label: type })), 'value', 'label', true);

            // Branches
            const branches = [...new Set(data.map(d => d["Branch"]))];
            branchChoices.setChoices(branches.map(branch => ({ value: branch, label: branch })), 'value', 'label', true);

            // College types already populated in HTML
        }

        // Get selected values from Choices.js dropdowns
        function getSelectedValues(choicesInstance) {
            return choicesInstance.getValue(true);
        }

        // Show loading state
        function showLoading(show) {
            if (show) {
                const loadingDiv = document.createElement('div');
                loadingDiv.className = 'loading';
                loadingDiv.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Loading colleges...';
                document.querySelector('main').appendChild(loadingDiv);
            } else {
                const loading = document.querySelector('.loading');
                if (loading) loading.remove();
            }
        }

        // Filter data based on form selections
        function filterData() {
            const seatTypes = getSelectedValues(seatChoices);
            const branches = getSelectedValues(branchChoices);
            const collegeTypes = getSelectedValues(collegeChoices);
            const predictType = document.querySelector('input[name="predictType"]:checked').value;
            const inputValue = parseFloat(document.getElementById("inputValue").value);
            const collegeCount = document.getElementById("collegeCount").value;

            // Validate input
            if (isNaN(inputValue)) {
                showNotification("Please enter a valid percentile or rank", "error");
                return null;
            }

            if (predictType === "percentile" && (inputValue < 0 || inputValue > 100)) {
                showNotification("Percentile must be between 0 and 100", "error");
                return null;
            }

            let filtered = [...excelData];

            // Apply filters
            if (seatTypes.length > 0 && !seatTypes.includes("All")) {
                filtered = filtered.filter(d => seatTypes.includes(d["Seat Type"]));
            }

            if (branches.length > 0 && !branches.includes("All")) {
                filtered = filtered.filter(d => branches.includes(d["Branch"]));
            }

            if (collegeTypes.length > 0 && !collegeTypes.includes("All")) {
                filtered = filtered.filter(d => {
                    const collegeType = getCollegeTypeFromInstitute(d["Institute"]);
                    return collegeTypes.includes(collegeType);
                });
            }

            // Apply percentile/rank filter
            if (predictType === "rank") {
                filtered = filtered.filter(d => d["Rank"] && inputValue <= d["Rank"]);
            } else {
                filtered = filtered.filter(d => d["Percentile"] && inputValue >= d["Percentile"]);
            }

            // Sort by percentile descending
            filtered.sort((a, b) => (b["Percentile"] || 0) - (a["Percentile"] || 0));

            // Limit results
            if (collegeCount !== "all") {
                filtered = filtered.slice(0, parseInt(collegeCount));
            }

            return filtered;
        }

        // Display search parameters
        function displaySearchParams() {
            const seatTypes = getSelectedValues(seatChoices);
            const branches = getSelectedValues(branchChoices);
            const collegeTypes = getSelectedValues(collegeChoices);
            const predictType = document.querySelector('input[name="predictType"]:checked').value;
            const inputValue = document.getElementById("inputValue").value;

            const paramsContainer = document.getElementById("searchParams");
            paramsContainer.innerHTML = '';

            const params = [
                { label: "Seat Type", value: seatTypes.length > 0 ? seatTypes.join(", ") : "All" },
                { label: "Branch", value: branches.length > 0 ? branches.join(", ") : "All" },
                { label: "College Type", value: collegeTypes.length > 0 ? collegeTypes.join(", ") : "All" },
                { label: "Filter By", value: predictType === "percentile" ? "Percentile" : "Rank" },
                { label: predictType === "percentile" ? "Percentile" : "Rank", value: inputValue }
            ];

            params.forEach(param => {
                const card = document.createElement('div');
                card.className = 'param-card';
                card.innerHTML = `
                    <h3>${param.label}</h3>
                    <p>${param.value}</p>
                `;
                paramsContainer.appendChild(card);
            });
        }

        // Display results in table
        function displayResults(page = 1) {
            currentPage = page;
            const startIndex = (page - 1) * resultsPerPage;
            const endIndex = Math.min(startIndex + resultsPerPage, filteredData.length);
            const pageData = filteredData.slice(startIndex, endIndex);

            const resultsBody = document.getElementById("resultsBody");
            resultsBody.innerHTML = '';

            if (pageData.length === 0) {
                resultsBody.innerHTML = `<tr><td colspan="6" class="no-results">
                    <i class="fas fa-university"></i>
                    <p>No colleges found matching your criteria</p>
                </td></tr>`;
                return;
            }

            pageData.forEach(row => {
                const collegeType = getCollegeTypeFromInstitute(row["Institute"]);
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td>${row["Institute"] || "N/A"}</td>
                    <td>${row["Branch"] || "N/A"}</td>
                    <td>${collegeType}</td>
                    <td>${row["Seat Type"] || "N/A"}</td>
                    <td>${row["Rank"] !== undefined ? row["Rank"] : "N/A"}</td>
                    <td>${row["Percentile"] !== undefined ? row["Percentile"] : "N/A"}</td>
                `;
                resultsBody.appendChild(tr);
            });

            // Update pagination
            totalPages = Math.ceil(filteredData.length / resultsPerPage);
            document.getElementById("totalResults").textContent = filteredData.length;
            document.getElementById("currentPage").textContent = startIndex + 1;
            document.getElementById("totalPages").textContent = endIndex;

            renderPagination();
        }

        // Render pagination buttons
        function renderPagination() {
            const pagination = document.getElementById("pagination");
            pagination.innerHTML = '';

            // Previous button
            const prevButton = document.createElement('button');
            prevButton.innerHTML = '<i class="fas fa-chevron-left"></i>';
            prevButton.disabled = currentPage === 1;
            prevButton.addEventListener('click', () => displayResults(currentPage - 1));
            pagination.appendChild(prevButton);

            // Page buttons
            const startPage = Math.max(1, currentPage - 2);
            const endPage = Math.min(totalPages, startPage + 4);

            for (let i = startPage; i <= endPage; i++) {
                const pageButton = document.createElement('button');
                pageButton.textContent = i;
                pageButton.className = i === currentPage ? 'active' : '';
                pageButton.addEventListener('click', () => displayResults(i));
                pagination.appendChild(pageButton);
            }

            // Next button
            const nextButton = document.createElement('button');
            nextButton.innerHTML = '<i class="fas fa-chevron-right"></i>';
            nextButton.disabled = currentPage === totalPages;
            nextButton.addEventListener('click', () => displayResults(currentPage + 1));
            pagination.appendChild(nextButton);
        }

        // Download PDF
        function downloadPDF() {
            const { jsPDF } = window.jspdf;
            const doc = new jsPDF();
            
            // Title
            doc.setFontSize(18);
            doc.text("College Prediction Results", 105, 15, null, null, 'center');
            doc.setFontSize(12);
            
            // Parameters
            const params = document.querySelectorAll('.param-card');
            let yPos = 30;
            
            params.forEach(param => {
                const label = param.querySelector('h3').textContent;
                const value = param.querySelector('p').textContent;
                doc.text(`${label}: ${value}`, 15, yPos);
                yPos += 8;
            });
            
            // Table
            const headers = [["Institute", "Branch", "College Type", "Seat Type", "Closing Rank", "Percentile"]];
            const data = filteredData.map(row => [
                row["Institute"] || "N/A",
                row["Branch"] || "N/A",
                getCollegeTypeFromInstitute(row["Institute"]),
                row["Seat Type"] || "N/A",
                row["Rank"] !== undefined ? row["Rank"] : "N/A",
                row["Percentile"] !== undefined ? row["Percentile"] : "N/A"
            ]);
            
            doc.autoTable({
                startY: yPos + 10,
                head: headers,
                body: data,
                theme: 'grid',
                headStyles: { fillColor: [67, 97, 238] },
                styles: { fontSize: 9, cellPadding: 2 },
                margin: { top: yPos + 10 }
            });
            
            // Footer
            const date = new Date().toLocaleDateString();
            doc.setFontSize(10);
            doc.text(`Generated on ${date} | College Predictor`, 105, doc.internal.pageSize.height - 10, null, null, 'center');
            
            doc.save(`college-predictor-results-${new Date().getTime()}.pdf`);
        }

        // Reset form and show predictor
        function resetForm() {
            document.querySelector(".container").style.display = "block";
            document.getElementById("resultsContainer").style.display = "none";
            document.getElementById("predictorForm").reset();
            
            // Reset Choices.js dropdowns
            seatChoices.clearStore();
            branchChoices.clearStore();
            collegeChoices.clearStore();
            
            // Re-add the "All" options
            seatChoices.setChoices([{ value: "All", label: "All" }], 'value', 'label', false);
            branchChoices.setChoices([{ value: "All", label: "All" }], 'value', 'label', false);
            collegeChoices.setChoices([
                { value: "All", label: "All" },
                { value: "Government", label: "Government" },
                { value: "Autonomous", label: "Autonomous" },
                { value: "Aided", label: "Aided" },
                { value: "Unaided", label: "Unaided" }
            ], 'value', 'label', false);
        }

        // Search results
        function searchResults() {
            const searchTerm = document.getElementById("searchResults").value.toLowerCase();
            if (!searchTerm) {
                displayResults(currentPage);
                return;
            }
            
            const searchData = filteredData.filter(row => 
                (row["Institute"] && row["Institute"].toLowerCase().includes(searchTerm)) ||
                (row["Branch"] && row["Branch"].toLowerCase().includes(searchTerm)) ||
                (row["Seat Type"] && row["Seat Type"].toLowerCase().includes(searchTerm))
            );
            
            const resultsBody = document.getElementById("resultsBody");
            resultsBody.innerHTML = '';
            
            if (searchData.length === 0) {
                resultsBody.innerHTML = `<tr><td colspan="6">No colleges found matching "${searchTerm}"</td></tr>`;
                return;
            }
            
            searchData.forEach(row => {
                const collegeType = getCollegeTypeFromInstitute(row["Institute"]);
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td>${row["Institute"] || "N/A"}</td>
                    <td>${row["Branch"] || "N/A"}</td>
                    <td>${collegeType}</td>
                    <td>${row["Seat Type"] || "N/A"}</td>
                    <td>${row["Rank"] !== undefined ? row["Rank"] : "N/A"}</td>
                    <td>${row["Percentile"] !== undefined ? row["Percentile"] : "N/A"}</td>
                `;
                resultsBody.appendChild(tr);
            });
        }

        // Initialize application
        async function initApp() {
            try {
                // Initialize dropdowns
                initDropdowns();
                
                // Show loading
                showLoading(true);
                
                // Fetch data
                const response = await fetch("DSE-Engineering-College-List.json");
                const jsonData = await response.json();
                excelData = jsonData["MHT-CET College Data"];
                
                // Populate dropdowns
                populateDropdowns(excelData);
                
                // Hide loading
                showLoading(false);
                
                // Set up event listeners
                document.getElementById("predictButton").addEventListener("click", () => {
                    filteredData = filterData();
                    if (filteredData && filteredData.length > 0) {
                        document.querySelector(".container").style.display = "none";
                        document.getElementById("resultsContainer").style.display = "block";
                        displaySearchParams();
                        displayResults(1);
                    } else if (filteredData) {
                        showNotification("No colleges found matching your criteria", "info");
                    }
                });

                document.getElementById("resetBtn").addEventListener("click", resetForm);
                document.getElementById("downloadPdfBtn").addEventListener("click", downloadPDF);
                document.getElementById("searchResults").addEventListener("input", searchResults);
                document.getElementById("clearSearch").addEventListener("click", () => {
                    document.getElementById("searchResults").value = "";
                    displayResults(currentPage);
                });
                
            } catch (error) {
                showLoading(false);
                showNotification("Failed to load college data. Please try again later.", "error");
                console.error("Error loading data:", error);
            }
        }

        // Initialize the application when DOM is loaded
        document.addEventListener('DOMContentLoaded', initApp);